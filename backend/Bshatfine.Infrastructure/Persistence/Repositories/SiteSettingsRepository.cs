using Bshatfine.Application.Abstractions;
using Bshatfine.Application.Common;
using Bshatfine.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Bshatfine.Infrastructure.Persistence.Repositories;

public class SiteSettingsRepository(AppDbContext db) : ISiteSettingsRepository
{
    private const string ConflictMessage =
        "The contact details were changed by someone else. Reload to see the latest version, then apply your changes again.";

    public Task<SiteSettings?> GetAsync(CancellationToken ct) =>
        db.SiteSettings.FirstOrDefaultAsync(s => s.Id == SiteSettings.SingletonId, ct);

    public Task<SiteSettings?> GetReadOnlyAsync(CancellationToken ct) =>
        db.SiteSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Id == SiteSettings.SingletonId, ct);

    public void Add(SiteSettings settings) => db.SiteSettings.Add(settings);

    public void SetExpectedVersion(SiteSettings settings, uint version) =>
        db.Entry(settings).Property(s => s.Version).OriginalValue = version;

    public async Task SaveChangesAsync(CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyConflictException(ConflictMessage);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Two Admins saved the very first version at the same moment
            throw new ConcurrencyConflictException(ConflictMessage);
        }
    }
}