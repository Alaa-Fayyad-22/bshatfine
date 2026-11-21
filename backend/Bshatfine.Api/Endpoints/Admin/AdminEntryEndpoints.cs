using Bshatfine.Api.Security;
using Bshatfine.Application.Dtos;
using Bshatfine.Application.Services;

namespace Bshatfine.Api.Endpoints.Admin;

public static class AdminEntryEndpoints
{
    public static void MapAdminEntryEndpoints(this IEndpointRouteBuilder admin)
    {
        var group = admin.MapGroup("/entries");

        group.MapGet("/", async (EntryService service, CancellationToken ct, string? kind) =>
            Results.Ok(await service.GetAllForAdminAsync(kind ?? string.Empty, ct)));

        group.MapGet("/{id:guid}", async (Guid id, EntryService service, CancellationToken ct) =>
            await service.GetForAdminAsync(id, ct) is { } e ? Results.Ok(e) : Results.NotFound());

        group.MapPost("/", async (CreateEntryRequest request, EntryService service, CancellationToken ct) =>
        {
            var created = await service.CreateAsync(request, ct);
            return Results.Created($"/api/admin/entries/{created.Id}", created);
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateEntryRequest request, EntryService service, CancellationToken ct) =>
            await service.UpdateAsync(id, request, ct) is { } e ? Results.Ok(e) : Results.NotFound());

        group.MapPost("/{id:guid}/publish", async (Guid id, EntryService service, CancellationToken ct) =>
            await service.PublishAsync(id, ct) is { } e ? Results.Ok(e) : Results.NotFound());

        group.MapPost("/{id:guid}/unpublish", async (Guid id, EntryService service, CancellationToken ct) =>
            await service.UnpublishAsync(id, ct) is { } e ? Results.Ok(e) : Results.NotFound());

        // The complete new order of one kind: /api/admin/entries/order?kind=project
        group.MapPut("/order", async (ReorderEntriesRequest request, EntryService service, CancellationToken ct, string? kind) =>
            Results.Ok(await service.ReorderAsync(kind ?? string.Empty, request, ct)));

        group.MapDelete("/{id:guid}", async (Guid id, EntryService service, CancellationToken ct) =>
            await service.DeleteAsync(id, ct) ? Results.NoContent() : Results.NotFound());

        // ---------- Cover image ----------
        group.MapPost("/{id:guid}/cover", async (Guid id, IFormFile file, EntryService service, CancellationToken ct) =>
        {
            await using var stream = file.OpenReadStream();
            return await service.SetCoverImageAsync(id, stream, file.Length, ct) is { } e ? Results.Ok(e) : Results.NotFound();
        })
        .DisableAntiforgery()
        .WithFormOptions(multipartBodyLengthLimit: 11 * 1024 * 1024)
        .RequireRateLimiting(RateLimitPolicies.Uploads);

        group.MapDelete("/{id:guid}/cover", async (Guid id, EntryService service, CancellationToken ct) =>
            await service.RemoveCoverImageAsync(id, ct) is { } e ? Results.Ok(e) : Results.NotFound());
    }
}