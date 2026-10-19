using Bshatfine.Application.Services;

namespace Bshatfine.Api.Endpoints;

public static class PageEndpoints
{
    public static void MapPageEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/pages").AllowAnonymous();

        group.MapGet("/{key:maxlength(50)}", async (string key, PageService service, CancellationToken ct,
            string lang = "ar") =>
            await service.GetPublishedAsync(key, lang, ct) is { } page
                ? Results.Ok(page)
                : Results.NotFound());

        app.MapGet("/api/site-settings", async (SiteSettingsService service, CancellationToken ct, string lang = "ar") =>
    Results.Ok(await service.GetPublicAsync(lang, ct)))
    .AllowAnonymous();
    }
}