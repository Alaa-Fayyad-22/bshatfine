using Bshatfine.Application.Dtos;

namespace Bshatfine.Application.Abstractions;

public interface IUserAdminService
{
    Task<PagedResult<StaffUserDto>> GetPageAsync(StaffUserFilter filter, CancellationToken ct);
    Task<StaffUserDto?> GetAsync(Guid id, CancellationToken ct);
    Task<TemporaryPasswordResult> CreateAsync(CreateStaffUserRequest request, CancellationToken ct);
    Task<StaffUserDto?> UpdateAsync(Guid id, UpdateStaffUserRequest request, Guid actingUserId, CancellationToken ct);
    Task<StaffUserDto?> SetActiveAsync(Guid id, bool active, Guid actingUserId, CancellationToken ct);
    Task<TemporaryPasswordResult?> ResetPasswordAsync(Guid id, Guid actingUserId, CancellationToken ct);
    Task<StaffUserDto?> ForceLogoutAsync(Guid id, Guid actingUserId, CancellationToken ct);
    Task<StaffUserDto?> UnlockAsync(Guid id, CancellationToken ct);
}