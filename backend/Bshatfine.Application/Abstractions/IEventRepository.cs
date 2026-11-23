using Bshatfine.Domain.Events;

namespace Bshatfine.Application.Abstractions;

public interface IEventRepository
{
    // Public (read-only). "now" comes from the caller, so every query in a request uses the same moment.
    Task<List<Event>> GetUpcomingAsync(DateTime now, int limit, CancellationToken ct);
    Task<(List<Event> Items, int Total)> GetPastPageAsync(DateTime now, int page, int pageSize, CancellationToken ct);
    Task<Event?> GetPublishedByIdAsync(Guid id, CancellationToken ct);

    // Admin
    Task<(List<Event> Items, int Total)> GetPageAsync(int page, int pageSize, CancellationToken ct); // read-only
    Task<Event?> GetByIdAsync(Guid id, CancellationToken ct);                                         // tracked, for changes

    void Add(Event ev);
    void Remove(Event ev);
    void SetExpectedVersion(Event ev, uint version);
    Task SaveChangesAsync(CancellationToken ct);
}