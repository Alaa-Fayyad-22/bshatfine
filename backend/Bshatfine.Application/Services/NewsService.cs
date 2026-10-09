using Bshatfine.Application.Abstractions;
using Bshatfine.Application.Dtos;
using Bshatfine.Domain.Entities;

namespace Bshatfine.Application.Services;

public class NewsService(INewsRepository repository)
{
    // ---------- Public ----------
    public async Task<List<NewsDto>> GetPublishedAsync(int page, int pageSize, CancellationToken ct)
    {
        (page, pageSize) = NormalizePaging(page, pageSize);
        var items = await repository.GetPublishedAsync(page, pageSize, ct);
        return items.Select(n => n.ToDto()).ToList();
    }

    // ---------- Admin ----------
    public async Task<List<AdminNewsDto>> GetAllForAdminAsync(int page, int pageSize, CancellationToken ct)
    {
        (page, pageSize) = NormalizePaging(page, pageSize);
        var items = await repository.GetAllAsync(page, pageSize, ct);
        return items.Select(n => n.ToAdminDto()).ToList();
    }

    public async Task<AdminNewsDto?> GetByIdForAdminAsync(Guid id, CancellationToken ct)
    {
        var news = await repository.GetByIdAsync(id, ct);
        return news?.ToAdminDto();
    }

    public async Task<AdminNewsDto> CreateAsync(CreateNewsRequest request, CancellationToken ct)
    {
        var news = News.CreateDraft(request.Title, request.Body);
        repository.Add(news);
        await repository.SaveChangesAsync(ct);
        return news.ToAdminDto();
    }

    public Task<AdminNewsDto?> UpdateAsync(Guid id, UpdateNewsRequest request, CancellationToken ct) =>
        ChangeAsync(id, news => news.Edit(request.Title, request.Body), ct);

    public Task<AdminNewsDto?> PublishAsync(Guid id, CancellationToken ct) =>
        ChangeAsync(id, news => news.Publish(), ct);

    public Task<AdminNewsDto?> ArchiveAsync(Guid id, CancellationToken ct) =>
        ChangeAsync(id, news => news.Archive(), ct);

    // ---------- Helpers ----------
    private async Task<AdminNewsDto?> ChangeAsync(Guid id, Action<News> change, CancellationToken ct)
    {
        var news = await repository.GetByIdAsync(id, ct);
        if (news is null)
            return null;

        change(news);
        await repository.SaveChangesAsync(ct);
        return news.ToAdminDto();
    }

    private static (int Page, int PageSize) NormalizePaging(int page, int pageSize) =>
        (Math.Max(page, 1), Math.Clamp(pageSize, 1, 50));
}