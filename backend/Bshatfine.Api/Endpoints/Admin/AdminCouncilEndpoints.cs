using Bshatfine.Api.Security;
using Bshatfine.Application.Dtos;
using Bshatfine.Application.Security;
using Bshatfine.Application.Services;

namespace Bshatfine.Api.Endpoints.Admin;

public static class AdminCouncilEndpoints
{
    public static void MapAdminCouncilEndpoints(this IEndpointRouteBuilder admin)
    {
        var group = admin.MapGroup("/council").RequireAuthorization(Policies.AdminOnly);

        group.MapGet("/", async (CouncilService service, CancellationToken ct) =>
            Results.Ok(await service.GetAllForAdminAsync(ct)));

        group.MapGet("/{id:guid}", async (Guid id, CouncilService service, CancellationToken ct) =>
            await service.GetForAdminAsync(id, ct) is { } m ? Results.Ok(m) : Results.NotFound());

        group.MapPost("/", async (CreateCouncilMemberRequest request, CouncilService service, CancellationToken ct) =>
        {
            var created = await service.CreateAsync(request, ct);
            return Results.Created($"/api/admin/council/{created.Id}", created);
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateCouncilMemberRequest request,
            CouncilService service, CancellationToken ct) =>
            await service.UpdateAsync(id, request, ct) is { } m ? Results.Ok(m) : Results.NotFound());

        group.MapPost("/{id:guid}/activate", async (Guid id, CouncilService service, CancellationToken ct) =>
            await service.ActivateAsync(id, ct) is { } m ? Results.Ok(m) : Results.NotFound());

        group.MapPost("/{id:guid}/deactivate", async (Guid id, CouncilService service, CancellationToken ct) =>
            await service.DeactivateAsync(id, ct) is { } m ? Results.Ok(m) : Results.NotFound());

        group.MapPut("/order", async (ReorderCouncilRequest request, CouncilService service, CancellationToken ct) =>
            Results.Ok(await service.ReorderAsync(request, ct)));

        group.MapDelete("/{id:guid}", async (Guid id, CouncilService service, CancellationToken ct) =>
            await service.DeleteAsync(id, ct) ? Results.NoContent() : Results.NotFound());

        // ---------- Photo ----------
        group.MapPost("/{id:guid}/photo", async (Guid id, IFormFile file, CouncilService service, CancellationToken ct) =>
        {
            await using var stream = file.OpenReadStream();
            return await service.SetPhotoAsync(id, stream, file.Length, ct) is { } m ? Results.Ok(m) : Results.NotFound();
        })
        .DisableAntiforgery()
        .WithFormOptions(multipartBodyLengthLimit: 11 * 1024 * 1024)
        .RequireRateLimiting(RateLimitPolicies.Uploads);

        group.MapDelete("/{id:guid}/photo", async (Guid id, CouncilService service, CancellationToken ct) =>
            await service.RemovePhotoAsync(id, ct) is { } m ? Results.Ok(m) : Results.NotFound());
    }
}