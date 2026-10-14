using Bshatfine.Application.Dtos;

namespace Bshatfine.Application.Abstractions;

public interface IAuditLogQueries
{
    Task<PagedResult<AuditLogDto>> GetPageAsync(AuditLogFilter filter, CancellationToken ct);
}