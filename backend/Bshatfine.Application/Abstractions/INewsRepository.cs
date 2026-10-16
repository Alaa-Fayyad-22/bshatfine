using Bshatfine.Application.Dtos;
using Bshatfine.Domain.Entities;
using Bshatfine.Domain.Enums;

namespace Bshatfine.Application.Abstractions;

public interface INewsRepository
{
    Task<(List<NewsSummaryRow> Items, int TotalCount)> GetPublishedSummariesAsync(
    Language language, int page, int pageSize, CancellationToken ct);
    Task<News?> GetPublishedByIdAsync(Guid id, CancellationToken ct);
    Task<(List<News> Items, int TotalCount)> GetAllAsync(int page, int pageSize, NewsStatus? status, CancellationToken ct);
    Task<News?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<News?> GetPublishedBySlugAsync(string slug, CancellationToken ct);
    void Add(News news);
    Task SaveChangesAsync(CancellationToken ct);
    void Remove(News news);
    void SetExpectedVersion(News news, uint version);
}