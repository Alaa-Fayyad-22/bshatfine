namespace Bshatfine.Api.Security;

/// <summary>
/// Refuses state-changing requests (POST, PUT, PATCH, DELETE) to /api/admin and /api/auth
/// that a browser sends from another website. Browsers always add an Origin header to these
/// requests and a page cannot fake it, so a foreign Origin means another site is trying to
/// act with the visitor's session cookie (CSRF).
/// Requests without Origin or Referer (curl, server-to-server) are not from a browser page
/// and are left to the normal authentication.
/// </summary>
public static class OriginCheck
{
    public static IApplicationBuilder UseBshatfineOriginCheck(this IApplicationBuilder app, IEnumerable<string> allowedOrigins)
    {
        var allowed = new HashSet<string>(
            allowedOrigins.Select(o => o.TrimEnd('/')), StringComparer.OrdinalIgnoreCase);

        return app.Use(async (http, next) =>
        {
            if (ChangesState(http.Request) && IsProtectedPath(http.Request) && !ComesFromAllowedSite(http.Request, allowed))
            {
                await Results.Problem(
                        "Requests from other websites are not allowed.",
                        statusCode: StatusCodes.Status403Forbidden)
                    .ExecuteAsync(http);
                return;
            }

            await next();
        });
    }

    private static bool ChangesState(HttpRequest request) =>
        HttpMethods.IsPost(request.Method) || HttpMethods.IsPut(request.Method) ||
        HttpMethods.IsPatch(request.Method) || HttpMethods.IsDelete(request.Method);

    private static bool IsProtectedPath(HttpRequest request) =>
        request.Path.StartsWithSegments("/api/admin") || request.Path.StartsWithSegments("/api/auth");

    private static bool ComesFromAllowedSite(HttpRequest request, HashSet<string> allowed)
    {
        // "null" (sandboxed pages, some redirects) is not in the list, so it is refused
        var origin = request.Headers.Origin.ToString();
        if (origin.Length > 0)
            return allowed.Contains(origin);

        // Older browsers may send only Referer: compare its scheme + host + port
        var referer = request.Headers.Referer.ToString();
        if (referer.Length > 0)
            return Uri.TryCreate(referer, UriKind.Absolute, out var uri)
                && allowed.Contains(uri.GetLeftPart(UriPartial.Authority));

        return true; // no browser headers at all: not a cross-site browser request
    }
}