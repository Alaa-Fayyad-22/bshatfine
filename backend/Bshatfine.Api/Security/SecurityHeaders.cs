namespace Bshatfine.Api.Security;

public static class SecurityHeaders
{
    public static IApplicationBuilder UseBshatfineSecurityHeaders(this IApplicationBuilder app) =>
        app.Use(async (context, next) =>
        {
            // Added just before the response is sent, so even error responses get them
            context.Response.OnStarting(() =>
            {
                var headers = context.Response.Headers;
                headers["X-Content-Type-Options"] = "nosniff";
                headers["X-Frame-Options"] = "DENY";
                headers["Referrer-Policy"] = "no-referrer";
                headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()";
                headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";

                // Private data must never be stored by browsers or proxies
                var path = context.Request.Path;
                var isPrivate = path.StartsWithSegments("/api/admin") || path.StartsWithSegments("/api/auth");
                if (isPrivate && !headers.ContainsKey("Cache-Control"))
                    headers.CacheControl = "no-store";

                return Task.CompletedTask;
            });

            await next();
        });
}