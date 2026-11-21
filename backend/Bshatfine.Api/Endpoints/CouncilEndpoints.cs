using Bshatfine.Application.Services;

namespace Bshatfine.Api.Endpoints;

public static class CouncilEndpoints
{
    public static void MapCouncilEndpoints(this IEndpointRouteBuilder app) =>
        app.MapGet("/api/council", async (CouncilService service, CancellationToken ct, string lang = "ar") =>
            Results.Ok(await service.GetPublicAsync(lang, ct)))
            .AllowAnonymous();
}