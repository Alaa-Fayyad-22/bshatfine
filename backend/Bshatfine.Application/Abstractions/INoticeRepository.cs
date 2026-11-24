using Bshatfine.Domain.Enums;
using Bshatfine.Domain.Notices;

namespace Bshatfine.Application.Abstractions;

public interface INoticeRepository
{
    // Public (read-only). "now" comes from the caller, so every query in a request uses the same moment.
    Task<List<Notice>> GetActiveAsync(DateTime now, string? category, NoticePriority? priority, int limit, CancellationToken ct);
    Task<(List<Notice> Items, int Total)> GetArchivePageAsync(DateTime now, string? category, int page, int pageSize, CancellationToken ct);
    Task<Notice?> GetPublishedByIdAsync(Guid id, CancellationToken ct);

    // Admin
    Task<(List<Notice> Items, int Total)> GetPageAsync(int page, int pageSize, CancellationToken ct); // read-only
    Task<Notice?> GetByIdAsync(Guid id, CancellationToken ct);                                         // tracked, for changes

    void Add(Notice notice);
    void Remove(Notice notice);
    void SetExpectedVersion(Notice notice, uint version);
    Task SaveChangesAsync(CancellationToken ct);
}