using Bshatfine.Application.Dtos;
using Bshatfine.Application.Services;

namespace Bshatfine.Api.Endpoints.Admin;

public static class AdminNoticeEndpoints
{
    public static void MapAdminNoticeEndpoints(this IEndpointRouteBuilder admin)
    {
        var group = admin.MapGroup("/notices");

        // Newest first: /api/admin/notices?page=1&pageSize=20
        group.MapGet("/", async (NoticeService service, CancellationToken ct, int page = 1, int pageSize = 20) =>
            Results.Ok(await service.GetPageForAdminAsync(page, pageSize, ct)));

        group.MapGet("/{id:guid}", async (Guid id, NoticeService service, CancellationToken ct) =>
            await service.GetForAdminAsync(id, ct) is { } n ? Results.Ok(n) : Results.NotFound());

        group.MapPost("/", async (CreateNoticeRequest request, NoticeService service, CancellationToken ct) =>
        {
            var created = await service.CreateAsync(request, ct);
            return Results.Created($"/api/admin/notices/{created.Id}", created);
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateNoticeRequest request, NoticeService service, CancellationToken ct) =>
            await service.UpdateAsync(id, request, ct) is { } n ? Results.Ok(n) : Results.NotFound());

        group.MapPost("/{id:guid}/publish", async (Guid id, NoticeService service, CancellationToken ct) =>
            await service.PublishAsync(id, ct) is { } n ? Results.Ok(n) : Results.NotFound());

        group.MapPost("/{id:guid}/unpublish", async (Guid id, NoticeService service, CancellationToken ct) =>
            await service.UnpublishAsync(id, ct) is { } n ? Results.Ok(n) : Results.NotFound());

        group.MapDelete("/{id:guid}", async (Guid id, NoticeService service, CancellationToken ct) =>
            await service.DeleteAsync(id, ct) ? Results.NoContent() : Results.NotFound());
    }
}