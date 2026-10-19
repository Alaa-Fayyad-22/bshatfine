using Bshatfine.Api.Security;
using Bshatfine.Application.Dtos;
using Bshatfine.Application.Services;

namespace Bshatfine.Api.Endpoints.Admin;

public static class AdminPageEndpoints
{
    public static void MapAdminPageEndpoints(this IEndpointRouteBuilder admin)
    {
        var group = admin.MapGroup("/pages");

        group.MapGet("/", async (PageService service, CancellationToken ct) =>
            Results.Ok(await service.GetAllForAdminAsync(ct)));

        group.MapGet("/{key:maxlength(50)}", async (string key, PageService service, CancellationToken ct) =>
            await service.GetForAdminAsync(key, ct) is { } page ? Results.Ok(page) : Results.NotFound());

        group.MapPost("/", async (CreatePageRequest request, PageService service, CancellationToken ct) =>
        {
            var created = await service.CreateAsync(request, ct);
            return Results.Created($"/api/admin/pages/{created.Key}", created);
        });

        group.MapPut("/{key:maxlength(50)}", async (string key, UpdatePageRequest request,
            PageService service, CancellationToken ct) =>
            await service.UpdateAsync(key, request, ct) is { } page ? Results.Ok(page) : Results.NotFound());

        group.MapPost("/{key:maxlength(50)}/publish", async (string key, PageService service, CancellationToken ct) =>
            await service.PublishAsync(key, ct) is { } page ? Results.Ok(page) : Results.NotFound());

        group.MapPost("/{key:maxlength(50)}/unpublish", async (string key, PageService service, CancellationToken ct) =>
            await service.UnpublishAsync(key, ct) is { } page ? Results.Ok(page) : Results.NotFound());

        // ---------- Cover image ----------
        group.MapPost("/{key:maxlength(50)}/cover", async (string key, IFormFile file,
            PageService service, CancellationToken ct) =>
        {
            await using var stream = file.OpenReadStream();
            return await service.SetCoverImageAsync(key, stream, file.Length, ct) is { } page
                ? Results.Ok(page)
                : Results.NotFound();
        })
        .DisableAntiforgery()
        .WithFormOptions(multipartBodyLengthLimit: 11 * 1024 * 1024)
        .RequireRateLimiting(RateLimitPolicies.Uploads);

        group.MapDelete("/{key:maxlength(50)}/cover", async (string key, PageService service, CancellationToken ct) =>
            await service.RemoveCoverImageAsync(key, ct) is { } page ? Results.Ok(page) : Results.NotFound());
    }
}