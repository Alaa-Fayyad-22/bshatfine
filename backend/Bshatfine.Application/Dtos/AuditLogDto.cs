namespace Bshatfine.Application.Dtos;

public record AuditLogDto(
    Guid Id,
    DateTime OccurredAt,
    Guid? UserId,
    string? UserEmail,
    string Action,
    string? EntityType,
    string? EntityId,
    string? Details,
    string? IpAddress,
    string? UserAgent);

public record AuditLogFilter(
    string? UserEmail,
    string? Action,
    string? EntityType,
    string? EntityId,
    DateTime? From,
    DateTime? To,
    int Page,
    int PageSize);