namespace Bshatfine.Application.Abstractions;

public record AuditEvent(
    string Action,
    string? EntityType = null,
    string? EntityId = null,
    object? Details = null,
    Guid? UserId = null,
    string? UserEmail = null);

public interface IAuditLogger
{
    Task LogAsync(AuditEvent auditEvent, CancellationToken ct = default);
}