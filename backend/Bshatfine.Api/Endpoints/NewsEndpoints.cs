using Bshatfine.Application.Dtos;
using Bshatfine.Application.Services;

namespace Bshatfine.Api.Endpoints;

public static class NewsEndpoints
{
    public static void MapNewsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/news");

        group.MapGet("/", async (NewsService service, CancellationToken ct, int page = 1, int pageSize = 10) =>
            Results.Ok(await service.GetLatestAsync(page, pageSize, ct)));

        group.MapPost("/", async (CreateNewsRequest request, NewsService service, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Body))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["News"] = ["Title and body are required."]
                });
            }

            var created = await service.CreateAsync(request, ct);
            return Results.Created($"/api/news/{created.Id}", created);
        });
    }
}