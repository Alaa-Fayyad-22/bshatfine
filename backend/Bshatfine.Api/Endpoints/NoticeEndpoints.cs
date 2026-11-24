using Bshatfine.Application.Services;

namespace Bshatfine.Api.Endpoints;

public static class NoticeEndpoints
{
    public static void MapNoticeEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/notices").AllowAnonymous();

        // Active notices, urgent first: /api/notices?lang=ar&category=water&limit=4
        group.MapGet("/", async (NoticeService service, CancellationToken ct,
            string lang = "ar", string? category = null, int limit = 20) =>
            Results.Ok(await service.GetActiveAsync(lang, category, limit, ct)));

        // Active urgent notices for the banner on every page: /api/notices/urgent?lang=ar
        group.MapGet("/urgent", async (NoticeService service, CancellationToken ct, string lang = "ar") =>
            Results.Ok(await service.GetUrgentAsync(lang, ct)));

        // Expired notices: /api/notices/archive?lang=ar&category=roads&page=1&pageSize=12
        group.MapGet("/archive", async (NoticeService service, CancellationToken ct,
            string lang = "ar", string? category = null, int page = 1, int pageSize = 12) =>
            Results.Ok(await service.GetArchiveAsync(lang, category, page, pageSize, ct)));

        // One notice with its text: /api/notices/{id}?lang=ar
        group.MapGet("/{id:guid}", async (Guid id, NoticeService service, CancellationToken ct, string lang = "ar") =>
            await service.GetPublishedByIdAsync(id, lang, ct) is { } n ? Results.Ok(n) : Results.NotFound());
    }
}