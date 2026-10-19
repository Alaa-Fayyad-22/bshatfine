using Bshatfine.Application.Abstractions;
using Bshatfine.Application.Common;
using Bshatfine.Domain.Entities;
using Bshatfine.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Bshatfine.Infrastructure.Persistence.Repositories;

public class PageRepository(AppDbContext db) : IPageRepository
{
    public Task<Page?> GetByKeyAsync(string key, CancellationToken ct) =>
        db.Pages
            .Include(p => p.Translations)
            .FirstOrDefaultAsync(p => p.Key == key, ct);

    public Task<Page?> GetPublishedByKeyAsync(string key, CancellationToken ct) =>
        db.Pages
            .Include(p => p.Translations)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Key == key && p.IsPublished, ct);

    public Task<List<Page>> GetAllAsync(CancellationToken ct) =>
        db.Pages
            .Include(p => p.Translations)
            .AsNoTracking()
            .ToListAsync(ct);

    public void Add(Page page) => db.Pages.Add(page);

    public void SetExpectedVersion(Page page, uint version) =>
        db.Entry(page).Property(p => p.Version).OriginalValue = version;

    public async Task SaveChangesAsync(CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyConflictException(
                "This page was changed by someone else. Reload it to see the latest version, then apply your changes again.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw new DomainException("This page already exists.");
        }
    }
}