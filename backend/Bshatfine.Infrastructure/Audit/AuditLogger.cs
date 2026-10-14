using System.Security.Claims;
using System.Text.Json;
using Bshatfine.Application.Abstractions;
using Bshatfine.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;

namespace Bshatfine.Infrastructure.Audit;

public class AuditLogger(AppDbContext db, IHttpContextAccessor httpContextAccessor) : IAuditLogger
{
    private const int MaxEmailLength = 256;
    private const int MaxUserAgentLength = 256;

    public async Task LogAsync(AuditEvent auditEvent, CancellationToken ct = default)
    {
        var http = httpContextAccessor.HttpContext;
        var principal = http?.User;

        Guid? userId = auditEvent.UserId
            ?? (Guid.TryParse(principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null);

        var email = auditEvent.UserEmail
            ?? principal?.FindFirstValue(ClaimTypes.Email)
            ?? principal?.Identity?.Name;

        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.CreateVersion7(),
            OccurredAt = DateTime.UtcNow,
            UserId = userId,
            UserEmail = Truncate(email, MaxEmailLength),
            Action = auditEvent.Action,
            EntityType = auditEvent.EntityType,
            EntityId = auditEvent.EntityId,
            Details = auditEvent.Details is null ? null : JsonSerializer.Serialize(auditEvent.Details),
            IpAddress = http?.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Truncate(http?.Request.Headers.UserAgent.ToString(), MaxUserAgentLength)
        });

        await db.SaveChangesAsync(ct);
    }

    private static string? Truncate(string? value, int max) =>
        string.IsNullOrEmpty(value) ? null : value.Length <= max ? value : value[..max];
}