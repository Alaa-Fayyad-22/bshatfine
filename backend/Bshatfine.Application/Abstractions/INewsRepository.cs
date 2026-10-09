using Bshatfine.Domain.Entities;

namespace Bshatfine.Application.Abstractions;

public interface INewsRepository
{
    Task<List<News>> GetLatestAsync(int page, int pageSize, CancellationToken ct);
    Task AddAsync(News news, CancellationToken ct);
}