using Bshatfine.Application.Services;

namespace Bshatfine.Api.Endpoints;

public static class SiteSettingsEndpoints
{
    public static void MapSiteSettingsEndpoints(this IEndpointRouteBuilder app) =>
        app.MapGet("/api/site-settings", async (SiteSettingsService service, CancellationToken ct, string lang = "ar") =>
            Results.Ok(await service.GetPublicAsync(lang, ct)))
            .AllowAnonymous();
}