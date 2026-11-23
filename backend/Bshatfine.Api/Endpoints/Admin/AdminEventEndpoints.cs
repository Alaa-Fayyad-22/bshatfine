using Bshatfine.Api.Security;
using Bshatfine.Application.Dtos;
using Bshatfine.Application.Services;

namespace Bshatfine.Api.Endpoints.Admin;

public static class AdminEventEndpoints
{
    public static void MapAdminEventEndpoints(this IEndpointRouteBuilder admin)
    {
        var group = admin.MapGroup("/events");

        // Newest start first: /api/admin/events?page=1&pageSize=20
        group.MapGet("/", async (EventService service, CancellationToken ct, int page = 1, int pageSize = 20) =>
            Results.Ok(await service.GetPageForAdminAsync(page, pageSize, ct)));

        group.MapGet("/{id:guid}", async (Guid id, EventService service, CancellationToken ct) =>
            await service.GetForAdminAsync(id, ct) is { } e ? Results.Ok(e) : Results.NotFound());

        group.MapPost("/", async (CreateEventRequest request, EventService service, CancellationToken ct) =>
        {
            var created = await service.CreateAsync(request, ct);
            return Results.Created($"/api/admin/events/{created.Id}", created);
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateEventRequest request, EventService service, CancellationToken ct) =>
            await service.UpdateAsync(id, request, ct) is { } e ? Results.Ok(e) : Results.NotFound());

        group.MapPost("/{id:guid}/publish", async (Guid id, EventService service, CancellationToken ct) =>
            await service.PublishAsync(id, ct) is { } e ? Results.Ok(e) : Results.NotFound());

        group.MapPost("/{id:guid}/unpublish", async (Guid id, EventService service, CancellationToken ct) =>
            await service.UnpublishAsync(id, ct) is { } e ? Results.Ok(e) : Results.NotFound());

        group.MapDelete("/{id:guid}", async (Guid id, EventService service, CancellationToken ct) =>
            await service.DeleteAsync(id, ct) ? Results.NoContent() : Results.NotFound());

        // ---------- Cover image ----------
        group.MapPost("/{id:guid}/cover", async (Guid id, IFormFile file, EventService service, CancellationToken ct) =>
        {
            await using var stream = file.OpenReadStream();
            return await service.SetCoverImageAsync(id, stream, file.Length, ct) is { } e ? Results.Ok(e) : Results.NotFound();
        })
        .DisableAntiforgery()
        .WithFormOptions(multipartBodyLengthLimit: 11 * 1024 * 1024)
        .RequireRateLimiting(RateLimitPolicies.Uploads);

        group.MapDelete("/{id:guid}/cover", async (Guid id, EventService service, CancellationToken ct) =>
            await service.RemoveCoverImageAsync(id, ct) is { } e ? Results.Ok(e) : Results.NotFound());
    }
}