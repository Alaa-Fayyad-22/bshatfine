using Bshatfine.Application.Services;

namespace Bshatfine.Api.Endpoints;

public static class NewsEndpoints
{
    public static void MapNewsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/news");

        group.MapGet("/", async (NewsService service, CancellationToken ct, int page = 1, int pageSize = 10) =>
            Results.Ok(await service.GetPublishedAsync(page, pageSize, ct)));
    }
}