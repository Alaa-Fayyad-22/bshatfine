using Bshatfine.Application.Abstractions;
using Bshatfine.Application.Dtos;
using Bshatfine.Domain.Entities;

namespace Bshatfine.Application.Services;

public class NewsService(INewsRepository repository)
{
    public async Task<List<NewsDto>> GetLatestAsync(int page, int pageSize, CancellationToken ct)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var items = await repository.GetLatestAsync(page, pageSize, ct);
        return items.Select(n => new NewsDto(n.Id, n.Title, n.Body, n.PublishedAt)).ToList();
    }

    public async Task<NewsDto> CreateAsync(CreateNewsRequest request, CancellationToken ct)
    {
        var news = new News
        {
            Id = Guid.CreateVersion7(),
            Title = request.Title.Trim(),
            Body = request.Body.Trim(),
            PublishedAt = DateTime.UtcNow
        };

        await repository.AddAsync(news, ct);
        return new NewsDto(news.Id, news.Title, news.Body, news.PublishedAt);
    }
}