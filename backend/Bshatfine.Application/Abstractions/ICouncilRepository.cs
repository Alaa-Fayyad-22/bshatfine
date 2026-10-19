using Bshatfine.Domain.Entities;

namespace Bshatfine.Application.Abstractions;

public interface ICouncilRepository
{
    Task<List<CouncilMember>> GetActiveAsync(CancellationToken ct);   // public page
    Task<List<CouncilMember>> GetAllAsync(CancellationToken ct);      // admin list
    Task<List<CouncilMember>> GetAllTrackedAsync(CancellationToken ct); // reordering
    Task<CouncilMember?> GetByIdAsync(Guid id, CancellationToken ct);
    void Add(CouncilMember member);
    void Remove(CouncilMember member);
    void SetExpectedVersion(CouncilMember member, uint version);
    Task SaveChangesAsync(CancellationToken ct);
}