using Bshatfine.Application.Abstractions;

namespace Bshatfine.Api.Endpoints;

public static class FileEndpoints
{
    public static void MapFileEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/files/{id:guid}", async (Guid id, IFileStorage storage, HttpContext http, CancellationToken ct) =>
        {
            var file = await storage.ReadAsync(id.ToString(), ct);
            if (file is null)
                return Results.NotFound();

            // Browsers: a file never changes at its address, so keep it for a year.
            // Shared caches (Vercel's CDN): at most 1 hour, so a DELETED photo stops being
            // public within an hour instead of staying online for a year.
            http.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
            http.Response.Headers["CDN-Cache-Control"] = "public, max-age=3600";
            http.Response.Headers["X-Content-Type-Options"] = "nosniff";
            return Results.File(file.Data, file.ContentType);
        }).AllowAnonymous();
    }
}