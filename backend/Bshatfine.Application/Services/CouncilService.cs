using Bshatfine.Application.Abstractions;
using Bshatfine.Application.Common;
using Bshatfine.Application.Dtos;
using Bshatfine.Application.Images;
using Bshatfine.Application.Security;
using Bshatfine.Domain.Entities;
using Bshatfine.Domain.Enums;
using Bshatfine.Domain.Exceptions;

namespace Bshatfine.Application.Services;

public class CouncilService(ICouncilRepository repository, IFileStorage storage,
    CoverImageService images, IAuditLogger audit)
{
    private const string EntityType = "CouncilMember";

    // ---------- Public ----------
    public async Task<List<CouncilMemberDto>> GetPublicAsync(string lang, CancellationToken ct)
    {
        var language = EnumParsing.ParseName<Language>(lang, "language");
        var members = await repository.GetActiveAsync(ct);

        return members
            .Select(m => new CouncilMemberDto(
                m.Id,
                language == Language.Ar ? m.NameAr : m.NameEn ?? m.NameAr,
                language == Language.Ar ? m.PositionAr : m.PositionEn ?? m.PositionAr,
                PhotoUrl(m)))
            .ToList();
    }

    // ---------- Admin: reading ----------
    public async Task<List<AdminCouncilMemberDto>> GetAllForAdminAsync(CancellationToken ct) =>
        (await repository.GetAllAsync(ct)).Select(ToAdminDto).ToList();

    public async Task<AdminCouncilMemberDto?> GetForAdminAsync(Guid id, CancellationToken ct)
    {
        var member = await repository.GetByIdAsync(id, ct);
        return member is null ? null : ToAdminDto(member);
    }

    // ---------- Admin: changes (each one audited) ----------
    public async Task<AdminCouncilMemberDto> CreateAsync(CreateCouncilMemberRequest request, CancellationToken ct)
    {
        // New members go to the end of the list
        var existing = await repository.GetAllAsync(ct);
        var nextOrder = existing.Count == 0 ? 0 : existing.Max(m => m.DisplayOrder) + 1;

        var member = CouncilMember.Create(request.NameAr, request.NameEn,
            request.PositionAr, request.PositionEn, Math.Min(nextOrder, 1000));

        repository.Add(member);
        await repository.SaveChangesAsync(ct);
        await Log(AuditActions.CouncilMemberCreated, member, ct);

        return ToAdminDto(member);
    }

    public async Task<AdminCouncilMemberDto?> UpdateAsync(Guid id, UpdateCouncilMemberRequest request, CancellationToken ct)
    {
        if (request.Version is not { } version)
            throw new DomainException("The version is required. Reload the page and try again.");

        return await ChangeAsync(id, m => m.UpdateDetails(request.NameAr, request.NameEn,
            request.PositionAr, request.PositionEn), AuditActions.CouncilMemberUpdated, ct, version);
    }

    public Task<AdminCouncilMemberDto?> ActivateAsync(Guid id, CancellationToken ct) =>
        ChangeAsync(id, m => m.Activate(), AuditActions.CouncilMemberActivated, ct);

    public Task<AdminCouncilMemberDto?> DeactivateAsync(Guid id, CancellationToken ct) =>
        ChangeAsync(id, m => m.Deactivate(), AuditActions.CouncilMemberDeactivated, ct);

    public async Task<List<AdminCouncilMemberDto>> ReorderAsync(ReorderCouncilRequest request, CancellationToken ct)
    {
        var members = await repository.GetAllTrackedAsync(ct);
        var ids = request.Ids ?? [];

        // The new order must list every member exactly once: no duplicates, no unknown ids, none missing
        if (ids.Count != members.Count
            || ids.Distinct().Count() != ids.Count
            || !ids.All(id => members.Any(m => m.Id == id)))
            throw new DomainException("The new order must list every council member exactly once.");

        for (var position = 0; position < ids.Count; position++)
            members.Single(m => m.Id == ids[position]).SetDisplayOrder(position);

        await repository.SaveChangesAsync(ct);
        await audit.LogAsync(new AuditEvent(AuditActions.CouncilReordered, EntityType, "all"), ct);

        return members.OrderBy(m => m.DisplayOrder).Select(ToAdminDto).ToList();
    }

    public async Task<AdminCouncilMemberDto?> SetPhotoAsync(Guid id, Stream content, long length, CancellationToken ct)
    {
        var member = await repository.GetByIdAsync(id, ct);
        if (member is null)
            return null;

        var newKey = await images.SaveAsync(content, length, "council", ct);
        var oldKey = member.PhotoPath;

        try
        {
            member.SetPhoto(newKey);
            await repository.SaveChangesAsync(ct);
        }
        catch
        {
            await storage.DeleteAsync(newKey, ct);
            throw;
        }

        if (oldKey is not null)
            await storage.DeleteAsync(oldKey, ct);

        await Log(AuditActions.CouncilMemberPhotoSet, member, ct);
        return ToAdminDto(member);
    }

    public async Task<AdminCouncilMemberDto?> RemovePhotoAsync(Guid id, CancellationToken ct)
    {
        var member = await repository.GetByIdAsync(id, ct);
        if (member is null)
            return null;

        var oldKey = member.PhotoPath;
        member.RemovePhoto();
        await repository.SaveChangesAsync(ct);

        if (oldKey is not null)
            await storage.DeleteAsync(oldKey, ct);

        await Log(AuditActions.CouncilMemberPhotoRemoved, member, ct);
        return ToAdminDto(member);
    }

    // For members entered by mistake. Former members should be deactivated instead.
    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var member = await repository.GetByIdAsync(id, ct);
        if (member is null)
            return false;

        var photoKey = member.PhotoPath;
        var name = member.NameAr;

        repository.Remove(member);
        await repository.SaveChangesAsync(ct);

        if (photoKey is not null)
            await storage.DeleteAsync(photoKey, ct);

        await audit.LogAsync(new AuditEvent(AuditActions.CouncilMemberDeleted, EntityType, id.ToString(),
            Details: new { name }), ct);
        return true;
    }

    // ---------- Helpers ----------
    private async Task<AdminCouncilMemberDto?> ChangeAsync(Guid id, Action<CouncilMember> change,
        string auditAction, CancellationToken ct, uint? expectedVersion = null)
    {
        var member = await repository.GetByIdAsync(id, ct);
        if (member is null)
            return null;

        if (expectedVersion is { } version)
            repository.SetExpectedVersion(member, version);

        change(member);
        await repository.SaveChangesAsync(ct);
        await Log(auditAction, member, ct);

        return ToAdminDto(member);
    }

    private Task Log(string action, CouncilMember member, CancellationToken ct) =>
        audit.LogAsync(new AuditEvent(action, EntityType, member.Id.ToString(),
            Details: new { name = member.NameAr }), ct);

    private string? PhotoUrl(CouncilMember m) =>
        m.PhotoPath is null ? null : storage.GetPublicUrl(m.PhotoPath);

    private AdminCouncilMemberDto ToAdminDto(CouncilMember m) =>
        new(m.Id, m.NameAr, m.NameEn, m.PositionAr, m.PositionEn, PhotoUrl(m),
            m.DisplayOrder, m.IsActive, m.CreatedAt, m.UpdatedAt, m.Version);
}