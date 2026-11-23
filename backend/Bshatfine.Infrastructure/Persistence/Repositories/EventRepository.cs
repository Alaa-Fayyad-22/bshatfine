using Bshatfine.Application.Abstractions;
using Bshatfine.Domain.Events;
using Microsoft.EntityFrameworkCore;

namespace Bshatfine.Infrastructure.Persistence.Repositories;

public class EventRepository(AppDbContext db) : IEventRepository
{
    private const string ConflictMessage =
        "This event was changed by someone else. Reload it to see the latest version, then apply your changes again.";

    // ---------- Public ----------
    // Soonest first: what's happening next
    public Task<List<Event>> GetUpcomingAsync(DateTime now, int limit, CancellationToken ct) =>
        WithTranslations().AsNoTracking()
            .Where(e => e.IsPublished && e.FinishesAt >= now)
            .OrderBy(e => e.StartsAt).ThenBy(e => e.Id)
            .Take(limit)
            .ToListAsync(ct);

    // Most recent first: the archive reads backwards in time
    public Task<(List<Event> Items, int Total)> GetPastPageAsync(DateTime now, int page, int pageSize, CancellationToken ct) =>
        PageAsync(
            db.Events.Where(e => e.IsPublished && e.FinishesAt < now),
            q => q.OrderByDescending(e => e.StartsAt).ThenBy(e => e.Id),
            page, pageSize, ct);

    public Task<Event?> GetPublishedByIdAsync(Guid id, CancellationToken ct) =>
        WithTranslations().AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == id && e.IsPublished, ct);

    // ---------- Admin ----------
    // Latest start first: new and upcoming events are at the top
    public Task<(List<Event> Items, int Total)> GetPageAsync(int page, int pageSize, CancellationToken ct) =>
        PageAsync(
            db.Events,
            q => q.OrderByDescending(e => e.StartsAt).ThenBy(e => e.Id),
            page, pageSize, ct);

    public Task<Event?> GetByIdAsync(Guid id, CancellationToken ct) =>
        WithTranslations().FirstOrDefaultAsync(e => e.Id == id, ct);

    public void Add(Event ev) => db.Events.Add(ev);

    public void Remove(Event ev) => db.Events.Remove(ev);

    public void SetExpectedVersion(Event ev, uint version) => db.SetExpectedVersion(ev, version);

    public Task SaveChangesAsync(CancellationToken ct) => db.SaveChangesOrConflictAsync(ConflictMessage, ct);

    // ---------- Building blocks ----------
    private IQueryable<Event> WithTranslations() => db.Events.Include(e => e.Translations);

    // Count on the filter alone, then load one page with its translations
    private static async Task<(List<Event> Items, int Total)> PageAsync(
        IQueryable<Event> filtered,
        Func<IQueryable<Event>, IOrderedQueryable<Event>> order,
        int page, int pageSize, CancellationToken ct)
    {
        var total = await filtered.CountAsync(ct);

        var items = await order(filtered.Include(e => e.Translations).AsNoTracking())
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }
}