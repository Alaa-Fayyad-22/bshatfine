using Bshatfine.Domain.Entries;
using Bshatfine.Domain.Enums;

namespace Bshatfine.Application.Abstractions;

public interface IEntryRepository
{
    // Public (read-only)
    Task<List<Entry>> GetPublishedAsync(EntryKind kind, CancellationToken ct);
    Task<Entry?> GetPublishedByIdAsync(Guid id, CancellationToken ct);

    // Admin
    Task<List<Entry>> GetAllAsync(EntryKind kind, CancellationToken ct);        // read-only
    Task<List<Entry>> GetAllTrackedAsync(EntryKind kind, CancellationToken ct); // for reordering
    Task<Entry?> GetByIdAsync(Guid id, CancellationToken ct);                   // tracked, for changes
    Task<int> GetNextDisplayOrderAsync(EntryKind kind, CancellationToken ct);

    void Add(Entry entry);
    void Remove(Entry entry);
    void SetExpectedVersion(Entry entry, uint version);
    Task SaveChangesAsync(CancellationToken ct);
}