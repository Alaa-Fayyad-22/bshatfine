using Bshatfine.Domain.Entities;

namespace Bshatfine.Application.Abstractions;

public interface INewsRepository
{
    Task<(List<News> Items, int TotalCount)> GetPublishedAsync(int page, int pageSize, CancellationToken ct);
    Task<News?> GetPublishedByIdAsync(Guid id, CancellationToken ct);
    Task<(List<News> Items, int TotalCount)> GetAllAsync(int page, int pageSize, CancellationToken ct);
    Task<News?> GetByIdAsync(Guid id, CancellationToken ct);
    void Add(News news);
    Task SaveChangesAsync(CancellationToken ct);
    Task<News?> GetPublishedBySlugAsync(string slug, CancellationToken ct);
}