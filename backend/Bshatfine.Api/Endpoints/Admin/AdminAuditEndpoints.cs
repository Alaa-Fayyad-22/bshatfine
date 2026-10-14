using Bshatfine.Application.Abstractions;
using Bshatfine.Application.Dtos;
using Bshatfine.Application.Security;

namespace Bshatfine.Api.Endpoints.Admin;

public static class AdminAuditEndpoints
{
    public static void MapAdminAuditEndpoints(this IEndpointRouteBuilder admin)
    {
        admin.MapGet("/audit", async (IAuditLogQueries audit, CancellationToken ct,
            string? userEmail, string? action, string? entityType, string? entityId,
            DateTime? from, DateTime? to, int page = 1, int pageSize = 50) =>
        {
            var filter = new AuditLogFilter(userEmail, action, entityType, entityId, from, to, page, pageSize);
            return Results.Ok(await audit.GetPageAsync(filter, ct));
        }).RequireAuthorization(Policies.AdminOnly);
    }
}