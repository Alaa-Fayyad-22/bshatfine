using Bshatfine.Application.Abstractions;
using Bshatfine.Application.Dtos;
using Bshatfine.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Bshatfine.Infrastructure.Audit;

public class AuditLogQueries(AppDbContext db) : IAuditLogQueries
{
    public async Task<PagedResult<AuditLogDto>> GetPageAsync(AuditLogFilter filter, CancellationToken ct)
    {
        var page = Math.Max(filter.Page, 1);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);

        var query = db.AuditLogs.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(filter.UserEmail))
            query = query.Where(a => a.UserEmail != null && EF.Functions.ILike(a.UserEmail, $"%{filter.UserEmail}%"));

        if (!string.IsNullOrWhiteSpace(filter.Action))
            query = query.Where(a => a.Action == filter.Action);

        if (!string.IsNullOrWhiteSpace(filter.EntityType))
            query = query.Where(a => a.EntityType == filter.EntityType);

        if (!string.IsNullOrWhiteSpace(filter.EntityId))
            query = query.Where(a => a.EntityId == filter.EntityId);

        if (filter.From is { } from)
        {
            var fromUtc = DateTime.SpecifyKind(from, DateTimeKind.Utc);
            query = query.Where(a => a.OccurredAt >= fromUtc);
        }

        if (filter.To is { } to)
        {
            var toUtc = DateTime.SpecifyKind(to, DateTimeKind.Utc);
            query = query.Where(a => a.OccurredAt <= toUtc);
        }

        var total = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(a => a.OccurredAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new AuditLogDto(
                a.Id, a.OccurredAt, a.UserId, a.UserEmail, a.Action,
                a.EntityType, a.EntityId, a.Details, a.IpAddress, a.UserAgent))
            .ToListAsync(ct);

        return new PagedResult<AuditLogDto>(items, page, pageSize, total);
    }
}