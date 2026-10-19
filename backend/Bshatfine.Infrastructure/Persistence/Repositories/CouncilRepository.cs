using Bshatfine.Application.Abstractions;
using Bshatfine.Application.Common;
using Bshatfine.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Bshatfine.Infrastructure.Persistence.Repositories;

public class CouncilRepository(AppDbContext db) : ICouncilRepository
{
    public Task<List<CouncilMember>> GetActiveAsync(CancellationToken ct) =>
        db.CouncilMembers.AsNoTracking()
            .Where(m => m.IsActive)
            .OrderBy(m => m.DisplayOrder).ThenBy(m => m.NameAr)
            .ToListAsync(ct);

    public Task<List<CouncilMember>> GetAllAsync(CancellationToken ct) =>
        db.CouncilMembers.AsNoTracking()
            .OrderBy(m => m.DisplayOrder).ThenBy(m => m.NameAr)
            .ToListAsync(ct);

    public Task<List<CouncilMember>> GetAllTrackedAsync(CancellationToken ct) =>
        db.CouncilMembers.ToListAsync(ct);

    public Task<CouncilMember?> GetByIdAsync(Guid id, CancellationToken ct) =>
        db.CouncilMembers.FirstOrDefaultAsync(m => m.Id == id, ct);

    public void Add(CouncilMember member) => db.CouncilMembers.Add(member);

    public void Remove(CouncilMember member) => db.CouncilMembers.Remove(member);

    public void SetExpectedVersion(CouncilMember member, uint version) =>
        db.Entry(member).Property(m => m.Version).OriginalValue = version;

    public async Task SaveChangesAsync(CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyConflictException(
                "The council list was changed by someone else. Reload to see the latest version, then try again.");
        }
    }
}