using Bshatfine.Application.Services;

namespace Bshatfine.Api.Endpoints;

public static class EventEndpoints
{
    public static void MapEventEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/events").AllowAnonymous();

        // Upcoming and ongoing, soonest first: /api/events/upcoming?lang=ar&limit=3
        group.MapGet("/upcoming", async (EventService service, CancellationToken ct,
            string lang = "ar", int limit = 20) =>
            Results.Ok(await service.GetUpcomingAsync(lang, limit, ct)));

        // The archive, most recent first: /api/events/past?lang=ar&page=1&pageSize=12
        group.MapGet("/past", async (EventService service, CancellationToken ct,
            string lang = "ar", int page = 1, int pageSize = 12) =>
            Results.Ok(await service.GetPastAsync(lang, page, pageSize, ct)));

        // One event with its full text: /api/events/{id}?lang=ar
        group.MapGet("/{id:guid}", async (Guid id, EventService service, CancellationToken ct, string lang = "ar") =>
            await service.GetPublishedByIdAsync(id, lang, ct) is { } ev ? Results.Ok(ev) : Results.NotFound());
    }
}