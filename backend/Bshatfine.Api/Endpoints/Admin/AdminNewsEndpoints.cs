using Bshatfine.Application.Dtos;
using Bshatfine.Application.Services;
using Bshatfine.Api.Security;

namespace Bshatfine.Api.Endpoints.Admin;

public static class AdminNewsEndpoints
{
    public static void MapAdminNewsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/news");

        group.MapGet("/", async (NewsService service, CancellationToken ct,
            string? status, int page = 1, int pageSize = 20) =>
            Results.Ok(await service.GetAllForAdminAsync(page, pageSize, status, ct)));

        group.MapGet("/{id:guid}", async (Guid id, NewsService service, CancellationToken ct) =>
        {
            var news = await service.GetByIdForAdminAsync(id, ct);
            return news is null ? Results.NotFound() : Results.Ok(news);
        });

        group.MapDelete("/{id:guid}", async (Guid id, NewsService service, CancellationToken ct) =>
            await service.DeleteDraftAsync(id, ct) ? Results.NoContent() : Results.NotFound());

        group.MapPost("/", async (CreateNewsRequest request, NewsService service, CancellationToken ct) =>
        {
            var created = await service.CreateAsync(request, ct);
            return Results.Created($"/api/admin/news/{created.Id}", created);
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateNewsRequest request, NewsService service, CancellationToken ct) =>
        {
            var news = await service.UpdateAsync(id, request, ct);
            return news is null ? Results.NotFound() : Results.Ok(news);
        });

        group.MapPost("/{id:guid}/publish", async (Guid id, NewsService service, CancellationToken ct) =>
        {
            var news = await service.PublishAsync(id, ct);
            return news is null ? Results.NotFound() : Results.Ok(news);
        });

        group.MapPost("/{id:guid}/archive", async (Guid id, NewsService service, CancellationToken ct) =>
        {
            var news = await service.ArchiveAsync(id, ct);
            return news is null ? Results.NotFound() : Results.Ok(news);
        });

        group.MapPost("/{id:guid}/republish", async (Guid id, NewsService service, CancellationToken ct) =>
        {
            var news = await service.RepublishAsync(id, ct);
            return news is null ? Results.NotFound() : Results.Ok(news);
        });

        // ---------- Cover image ----------
        group.MapPost("/{id:guid}/cover", async (Guid id, IFormFile file, NewsService service, CancellationToken ct) =>
        {
            await using var stream = file.OpenReadStream();
            var news = await service.SetCoverImageAsync(id, stream, file.Length, ct);
            return news is null ? Results.NotFound() : Results.Ok(news);
        }).DisableAntiforgery()
        .WithFormOptions(multipartBodyLengthLimit: 11 * 1024 * 1024)
        .RequireRateLimiting(RateLimitPolicies.Uploads);

        group.MapDelete("/{id:guid}/cover", async (Guid id, NewsService service, CancellationToken ct) =>
        {
            var news = await service.RemoveCoverImageAsync(id, ct);
            return news is null ? Results.NotFound() : Results.Ok(news);
        });
    }
}