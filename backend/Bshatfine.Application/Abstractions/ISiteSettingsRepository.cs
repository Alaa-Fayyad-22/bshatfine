using Bshatfine.Domain.Entities;

namespace Bshatfine.Application.Abstractions;

public interface ISiteSettingsRepository
{
    Task<SiteSettings?> GetAsync(CancellationToken ct);          // tracked, for changes
    Task<SiteSettings?> GetReadOnlyAsync(CancellationToken ct);  // for reading
    void Add(SiteSettings settings);
    void SetExpectedVersion(SiteSettings settings, uint version);
    Task SaveChangesAsync(CancellationToken ct);
}