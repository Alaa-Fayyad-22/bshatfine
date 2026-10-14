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

            http.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
            http.Response.Headers["X-Content-Type-Options"] = "nosniff";
            return Results.File(file.Data, file.ContentType);
        }).AllowAnonymous();
    }
}