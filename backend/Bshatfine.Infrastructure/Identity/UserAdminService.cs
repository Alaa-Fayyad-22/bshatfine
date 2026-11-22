using Bshatfine.Application.Abstractions;
using Bshatfine.Application.Dtos;
using Bshatfine.Application.Security;
using Bshatfine.Domain.Exceptions;
using Bshatfine.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Bshatfine.Infrastructure.Identity;

public class UserAdminService(
    AppDbContext db, UserManager<AppUser> users, IAuditLogger audit, IExclusiveLock exclusive) : IUserAdminService
{
    private const string EntityType = "User";
    private const int MaxDisplayNameLength = 100;

    // Creating, demoting and disabling staff run one at a time, so two parallel requests
    // can never both pass the "last active Admin" or "email already exists" checks.
    private const string StaffAccountsLock = "staff-accounts";

    // ---------- Reading ----------
    public async Task<PagedResult<StaffUserDto>> GetPageAsync(StaffUserFilter filter, CancellationToken ct)
    {
        var page = Math.Max(filter.Page, 1);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);
        var now = DateTimeOffset.UtcNow;

        // Staff only: users joined with their role, Admin or Editor
        var query =
            from u in db.Users
            join ur in db.UserRoles on u.Id equals ur.UserId
            join r in db.Roles on ur.RoleId equals r.Id
            where r.Name == Roles.Admin || r.Name == Roles.Editor
            select new { User = u, Role = r.Name! };

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var pattern = $"%{filter.Search.Trim()}%";
            query = query.Where(x =>
                EF.Functions.ILike(x.User.Email!, pattern) || EF.Functions.ILike(x.User.DisplayName, pattern));
        }

        if (!string.IsNullOrWhiteSpace(filter.Role))
            query = query.Where(x => x.Role == filter.Role);

        if (filter.IsActive is { } active)
            query = query.Where(x => x.User.IsActive == active);

        var total = await query.CountAsync(ct);

        var items = await query
            .OrderBy(x => x.User.DisplayName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new StaffUserDto(
                x.User.Id, x.User.Email!, x.User.DisplayName, x.Role, x.User.IsActive,
                x.User.LockoutEnd != null && x.User.LockoutEnd > now,
                x.User.MustChangePassword, x.User.CreatedAt))
            .ToListAsync(ct);

        return new PagedResult<StaffUserDto>(items, page, pageSize, total);
    }

    public async Task<StaffUserDto?> GetAsync(Guid id, CancellationToken ct)
    {
        var (user, role) = await FindStaffAsync(id);
        return user is null || role is null ? null : ToDto(user, role);
    }

    // ---------- Changes (each one audited) ----------
    public Task<TemporaryPasswordResult> CreateAsync(CreateStaffUserRequest request, CancellationToken ct) =>
        exclusive.RunAsync(StaffAccountsLock, () => CreateCoreAsync(request, ct), ct);

    private async Task<TemporaryPasswordResult> CreateCoreAsync(CreateStaffUserRequest request, CancellationToken ct)
    {
        var role = RequireStaffRole(request.Role);
        var email = (request.Email ?? string.Empty).Trim();
        var name = RequireDisplayName(request.DisplayName);

        if (string.IsNullOrWhiteSpace(email))
            throw new DomainException("Email is required.");

        if (await users.FindByEmailAsync(email) is not null)
            throw new DomainException("An account with this email already exists.");

        // TODO (2FA, before launch): staff accounts get TwoFactorEnabled = true from creation,
        // so every staff login requires a second factor.
        var user = new AppUser
        {
            Id = Guid.CreateVersion7(),
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            DisplayName = name,
            IsActive = true,
            MustChangePassword = true,
            CreatedAt = DateTime.UtcNow
        };

        var temporaryPassword = TemporaryPasswordGenerator.Generate();
        EnsureSucceeded(await users.CreateAsync(user, temporaryPassword));
        EnsureSucceeded(await users.AddToRoleAsync(user, role));

        await audit.LogAsync(new AuditEvent(AuditActions.UserCreated, EntityType, user.Id.ToString(),
            Details: new { role }), ct);

        return new TemporaryPasswordResult(ToDto(user, role), temporaryPassword);
    }

    public Task<StaffUserDto?> UpdateAsync(Guid id, UpdateStaffUserRequest request, Guid actingUserId, CancellationToken ct) =>
        exclusive.RunAsync(StaffAccountsLock, () => UpdateCoreAsync(id, request, actingUserId, ct), ct);

    private async Task<StaffUserDto?> UpdateCoreAsync(Guid id, UpdateStaffUserRequest request, Guid actingUserId, CancellationToken ct)
    {
        var (user, currentRole) = await FindStaffAsync(id);
        if (user is null || currentRole is null)
            return null;

        var newRole = RequireStaffRole(request.Role);
        var name = RequireDisplayName(request.DisplayName);
        var roleChanged = currentRole != newRole;

        if (roleChanged && currentRole == Roles.Admin)
        {
            if (id == actingUserId)
                throw new DomainException("You cannot remove your own Admin role.");

            await EnsureNotLastActiveAdminAsync(user, ct);
        }

        user.DisplayName = name;
        EnsureSucceeded(await users.UpdateAsync(user));

        if (roleChanged)
        {
            EnsureSucceeded(await users.RemoveFromRoleAsync(user, currentRole));
            EnsureSucceeded(await users.AddToRoleAsync(user, newRole));
            EnsureSucceeded(await users.UpdateSecurityStampAsync(user)); // their sessions end; they log in again with the new role
        }

        await audit.LogAsync(roleChanged
            ? new AuditEvent(AuditActions.UserRoleChanged, EntityType, id.ToString(),
                Details: new { from = currentRole, to = newRole })
            : new AuditEvent(AuditActions.UserUpdated, EntityType, id.ToString()), ct);

        return ToDto(user, newRole);
    }

    public Task<StaffUserDto?> SetActiveAsync(Guid id, bool active, Guid actingUserId, CancellationToken ct) =>
        exclusive.RunAsync(StaffAccountsLock, () => SetActiveCoreAsync(id, active, actingUserId, ct), ct);

    private async Task<StaffUserDto?> SetActiveCoreAsync(Guid id, bool active, Guid actingUserId, CancellationToken ct)
    {
        var (user, role) = await FindStaffAsync(id);
        if (user is null || role is null)
            return null;

        if (!active)
        {
            if (id == actingUserId)
                throw new DomainException("You cannot disable your own account.");

            if (role == Roles.Admin)
                await EnsureNotLastActiveAdminAsync(user, ct);
        }

        user.IsActive = active;
        EnsureSucceeded(await users.UpdateAsync(user));

        if (!active)
            EnsureSucceeded(await users.UpdateSecurityStampAsync(user)); // open sessions end within a minute

        await audit.LogAsync(new AuditEvent(
            active ? AuditActions.UserEnabled : AuditActions.UserDisabled, EntityType, id.ToString()), ct);

        return ToDto(user, role);
    }

    public async Task<TemporaryPasswordResult?> ResetPasswordAsync(Guid id, Guid actingUserId, CancellationToken ct)
    {
        var (user, role) = await FindStaffAsync(id);
        if (user is null || role is null)
            return null;

        if (id == actingUserId)
            throw new DomainException("Use Change password to change your own password.");

        var temporaryPassword = TemporaryPasswordGenerator.Generate();
        var token = await users.GeneratePasswordResetTokenAsync(user);
        EnsureSucceeded(await users.ResetPasswordAsync(user, token, temporaryPassword)); // also ends their sessions

        user.MustChangePassword = true;
        EnsureSucceeded(await users.UpdateAsync(user));
        await users.SetLockoutEndDateAsync(user, null);
        await users.ResetAccessFailedCountAsync(user);

        await audit.LogAsync(new AuditEvent(AuditActions.UserPasswordReset, EntityType, id.ToString()), ct);

        return new TemporaryPasswordResult(ToDto(user, role), temporaryPassword);
    }

    public async Task<StaffUserDto?> ForceLogoutAsync(Guid id, Guid actingUserId, CancellationToken ct)
    {
        var (user, role) = await FindStaffAsync(id);
        if (user is null || role is null)
            return null;

        if (id == actingUserId)
            throw new DomainException("Use Log out to end your own session.");

        EnsureSucceeded(await users.UpdateSecurityStampAsync(user));

        await audit.LogAsync(new AuditEvent(AuditActions.UserForcedLogout, EntityType, id.ToString()), ct);

        return ToDto(user, role);
    }

    public async Task<StaffUserDto?> UnlockAsync(Guid id, CancellationToken ct)
    {
        var (user, role) = await FindStaffAsync(id);
        if (user is null || role is null)
            return null;

        await users.SetLockoutEndDateAsync(user, null);
        await users.ResetAccessFailedCountAsync(user);

        await audit.LogAsync(new AuditEvent(AuditActions.UserUnlocked, EntityType, id.ToString()), ct);

        return ToDto(user, role);
    }

    // ---------- Helpers ----------

    // Only Admin and Editor accounts are managed here; citizens are never returned
    private async Task<(AppUser? User, string? Role)> FindStaffAsync(Guid id)
    {
        var user = await users.FindByIdAsync(id.ToString());
        if (user is null)
            return (null, null);

        var role = (await users.GetRolesAsync(user)).FirstOrDefault(r => Roles.Staff.Contains(r));
        return role is null ? (null, null) : (user, role);
    }

    // Counts in the database (not from tracked entities), so it always sees changes
    // committed by a parallel request that held the lock just before us.
    private async Task EnsureNotLastActiveAdminAsync(AppUser user, CancellationToken ct)
    {
        var activeAdmins = await (
            from u in db.Users.AsNoTracking()
            join ur in db.UserRoles on u.Id equals ur.UserId
            join r in db.Roles on ur.RoleId equals r.Id
            where r.Name == Roles.Admin && u.IsActive
            select u.Id).CountAsync(ct);

        if (user.IsActive && activeAdmins <= 1)
            throw new DomainException("This is the last active Admin. Create or enable another Admin first.");
    }

    private static string RequireStaffRole(string? role) =>
        role is Roles.Admin or Roles.Editor
            ? role
            : throw new DomainException("Role must be Admin or Editor.");

    private static string RequireDisplayName(string? displayName)
    {
        var name = (displayName ?? string.Empty).Trim();
        if (name.Length == 0)
            throw new DomainException("Display name is required.");
        if (name.Length > MaxDisplayNameLength)
            throw new DomainException($"Display name cannot exceed {MaxDisplayNameLength} characters.");
        return name;
    }

    private static void EnsureSucceeded(IdentityResult result)
    {
        if (!result.Succeeded)
            throw new DomainException(string.Join(" ", result.Errors.Select(e => e.Description)));
    }

    private static StaffUserDto ToDto(AppUser user, string role) =>
        new(user.Id, user.Email!, user.DisplayName, role, user.IsActive,
            user.LockoutEnd > DateTimeOffset.UtcNow, user.MustChangePassword, user.CreatedAt);
}