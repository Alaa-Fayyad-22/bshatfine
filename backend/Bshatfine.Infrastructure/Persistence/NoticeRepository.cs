using Bshatfine.Application.Abstractions;
using Bshatfine.Domain.Enums;
using Bshatfine.Domain.Notices;
using Microsoft.EntityFrameworkCore;

namespace Bshatfine.Infrastructure.Persistence.Repositories;

public class NoticeRepository(AppDbContext db) : INoticeRepository
{
    private const string ConflictMessage =
        "This notice was changed by someone else. Reload it to see the latest version, then apply your changes again.";

    // ---------- Public ----------
    // Still current: no end, or the end is still ahead. Urgent first, then important, then the newest.
    public Task<List<Notice>> GetActiveAsync(DateTime now, string? category, NoticePriority? priority, int limit, CancellationToken ct)
    {
        var query = WithTranslations().AsNoTracking()
            .Where(n => n.IsPublished && (n.ValidUntil == null || n.ValidUntil >= now));

        if (category is not null)
            query = query.Where(n => n.Category == category);
        if (priority is { } p)
            query = query.Where(n => n.Priority == p);

        return query
            .OrderByDescending(n => n.Priority == NoticePriority.Urgent ? 2 : n.Priority == NoticePriority.Important ? 1 : 0)
            .ThenByDescending(n => n.PublishedAt)
            .ThenBy(n => n.Id)
            .Take(limit)
            .ToListAsync(ct);
    }

    // The archive: notices whose end has passed, most recently ended first
    public Task<(List<Notice> Items, int Total)> GetArchivePageAsync(DateTime now, string? category, int page, int pageSize, CancellationToken ct)
    {
        var filtered = db.Notices.Where(n => n.IsPublished && n.ValidUntil != null && n.ValidUntil < now);
        if (category is not null)
            filtered = filtered.Where(n => n.Category == category);

        return PageAsync(filtered, q => q.OrderByDescending(n => n.ValidUntil).ThenBy(n => n.Id), page, pageSize, ct);
    }

    public Task<Notice?> GetPublishedByIdAsync(Guid id, CancellationToken ct) =>
        WithTranslations().AsNoTracking()
            .FirstOrDefaultAsync(n => n.Id == id && n.IsPublished, ct);

    // ---------- Admin ----------
    public Task<(List<Notice> Items, int Total)> GetPageAsync(int page, int pageSize, CancellationToken ct) =>
        PageAsync(db.Notices, q => q.OrderByDescending(n => n.CreatedAt).ThenBy(n => n.Id), page, pageSize, ct);

    public Task<Notice?> GetByIdAsync(Guid id, CancellationToken ct) =>
        WithTranslations().FirstOrDefaultAsync(n => n.Id == id, ct);

    public void Add(Notice notice) => db.Notices.Add(notice);

    public void Remove(Notice notice) => db.Notices.Remove(notice);

    public void SetExpectedVersion(Notice notice, uint version) => db.SetExpectedVersion(notice, version);

    public Task SaveChangesAsync(CancellationToken ct) => db.SaveChangesOrConflictAsync(ConflictMessage, ct);

    // ---------- Building blocks ----------
    private IQueryable<Notice> WithTranslations() => db.Notices.Include(n => n.Translations);

    // Count on the filter alone, then load one page with its translations
    private static async Task<(List<Notice> Items, int Total)> PageAsync(
        IQueryable<Notice> filtered,
        Func<IQueryable<Notice>, IOrderedQueryable<Notice>> order,
        int page, int pageSize, CancellationToken ct)
    {
        var total = await filtered.CountAsync(ct);

        var items = await order(filtered.Include(n => n.Translations).AsNoTracking())
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }
}