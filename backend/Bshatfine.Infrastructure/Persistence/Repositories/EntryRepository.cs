using Bshatfine.Application.Abstractions;
using Bshatfine.Domain.Entries;
using Bshatfine.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Bshatfine.Infrastructure.Persistence.Repositories;

public class EntryRepository(AppDbContext db) : IEntryRepository
{
    private const string ConflictMessage =
        "This entry was changed by someone else. Reload it to see the latest version, then apply your changes again.";

    // ---------- Public ----------
    public Task<List<Entry>> GetPublishedAsync(EntryKind kind, CancellationToken ct) =>
        InOrder(WithTranslations().AsNoTracking().Where(e => e.Kind == kind && e.IsPublished))
            .ToListAsync(ct);

    public Task<Entry?> GetPublishedByIdAsync(Guid id, CancellationToken ct) =>
        WithTranslations().AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == id && e.IsPublished, ct);

    // ---------- Admin ----------
    public Task<List<Entry>> GetAllAsync(EntryKind kind, CancellationToken ct) =>
        InOrder(WithTranslations().AsNoTracking().Where(e => e.Kind == kind)).ToListAsync(ct);

    public Task<List<Entry>> GetAllTrackedAsync(EntryKind kind, CancellationToken ct) =>
        db.Entries.Where(e => e.Kind == kind).ToListAsync(ct);

    public Task<Entry?> GetByIdAsync(Guid id, CancellationToken ct) =>
        WithTranslations().FirstOrDefaultAsync(e => e.Id == id, ct);

    public async Task<int> GetNextDisplayOrderAsync(EntryKind kind, CancellationToken ct)
    {
        var max = await db.Entries.Where(e => e.Kind == kind).MaxAsync(e => (int?)e.DisplayOrder, ct);
        return max is null ? 0 : max.Value + 1;
    }

    public void Add(Entry entry) => db.Entries.Add(entry);

    public void Remove(Entry entry) => db.Entries.Remove(entry);

    public void SetExpectedVersion(Entry entry, uint version) => db.SetExpectedVersion(entry, version);

    public Task SaveChangesAsync(CancellationToken ct) => db.SaveChangesOrConflictAsync(ConflictMessage, ct);

    // ---------- Building blocks ----------
    private IQueryable<Entry> WithTranslations() => db.Entries.Include(e => e.Translations);

    // Display order first; entries with the same position keep the order they were created in
    private static IQueryable<Entry> InOrder(IQueryable<Entry> query) =>
        query.OrderBy(e => e.DisplayOrder).ThenBy(e => e.CreatedAt);
}