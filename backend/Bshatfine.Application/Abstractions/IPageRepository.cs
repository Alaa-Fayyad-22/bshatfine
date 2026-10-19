using Bshatfine.Domain.Entities;

namespace Bshatfine.Application.Abstractions;

public interface IPageRepository
{
    Task<Page?> GetByKeyAsync(string key, CancellationToken ct);           // tracked, for changes
    Task<Page?> GetPublishedByKeyAsync(string key, CancellationToken ct);  // read-only, public
    Task<List<Page>> GetAllAsync(CancellationToken ct);                    // read-only, admin list
    void Add(Page page);
    void SetExpectedVersion(Page page, uint version);
    Task SaveChangesAsync(CancellationToken ct);
}