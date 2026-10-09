using Bshatfine.Domain.Entities;

namespace Bshatfine.Application.Dtos;

public static class NewsMappings
{
    public static NewsDto ToDto(this News news) =>
        new(news.Id, news.Title, news.Body, news.PublishedAt);

    public static AdminNewsDto ToAdminDto(this News news) =>
        new(news.Id, news.Title, news.Body, news.Status.ToString(),
            news.CreatedAt, news.UpdatedAt, news.PublishedAt);
}