using Bshatfine.Application.Services;

namespace Bshatfine.Api.Endpoints;

public static class NewsEndpoints
{
    public static void MapNewsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/news");

        group.MapGet("/", async (NewsService service, CancellationToken ct, string lang = "ar", int page = 1, int pageSize = 10) =>
            Results.Ok(await service.GetPublishedAsync(lang, page, pageSize, ct)));

        group.MapGet("/{id:guid}", async (Guid id, NewsService service, CancellationToken ct, string lang = "ar") =>
        {
            var news = await service.GetPublishedByIdAsync(lang, id, ct);
            return news is null ? Results.NotFound() : Results.Ok(news);
        });
    }
}