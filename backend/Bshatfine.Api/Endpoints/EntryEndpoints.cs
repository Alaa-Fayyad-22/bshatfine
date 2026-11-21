using Bshatfine.Application.Services;

namespace Bshatfine.Api.Endpoints;

public static class EntryEndpoints
{
    public static void MapEntryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/entries").AllowAnonymous();

        // A list of one kind: /api/entries?kind=project&lang=ar
        group.MapGet("/", async (EntryService service, CancellationToken ct, string? kind, string lang = "ar") =>
            Results.Ok(await service.GetPublishedAsync(kind ?? string.Empty, lang, ct)));

        // One entry with its full text: /api/entries/{id}?lang=ar
        group.MapGet("/{id:guid}", async (Guid id, EntryService service, CancellationToken ct, string lang = "ar") =>
            await service.GetPublishedByIdAsync(id, lang, ct) is { } entry ? Results.Ok(entry) : Results.NotFound());
    }
}