namespace Bshatfine.Application.Dtos;

public record StaffUserDto(
    Guid Id,
    string Email,
    string DisplayName,
    string Role,
    bool IsActive,
    bool IsLockedOut,
    bool MustChangePassword,
    DateTime CreatedAt);

public record CreateStaffUserRequest(string Email, string DisplayName, string Role);

public record UpdateStaffUserRequest(string DisplayName, string Role);

public record TemporaryPasswordResult(StaffUserDto User, string TemporaryPassword);

public record StaffUserFilter(string? Search, string? Role, bool? IsActive, int Page, int PageSize);