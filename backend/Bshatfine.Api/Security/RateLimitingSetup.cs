using System.Net;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;

namespace Bshatfine.Api.Security;

public static class RateLimitPolicies
{
    public const string Login = "login";
    public const string Admin = "admin";
    public const string Uploads = "uploads";
}

public static class RateLimitingSetup
{
    public static IServiceCollection AddBshatfineRateLimiting(this IServiceCollection services, IConfiguration config)
    {
        // Behind a reverse proxy (production), the real visitor IP arrives in a header.
        // Only trust that header from proxies we list ourselves.
        services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            foreach (var proxy in config.GetSection("ReverseProxy:KnownProxies").Get<string[]>() ?? [])
                options.KnownProxies.Add(IPAddress.Parse(proxy));
        });

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            options.OnRejected = async (context, ct) =>
            {
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                    context.HttpContext.Response.Headers.RetryAfter =
                        ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString();

                await Results.Problem(
                    detail: "Too many requests. Please wait a moment and try again.",
                    statusCode: StatusCodes.Status429TooManyRequests)
                    .ExecuteAsync(context.HttpContext);
            };

            // Applies to every request, in addition to any named policy
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(http =>
                FixedWindow(ClientIp(http), permits: 300));

            options.AddPolicy(RateLimitPolicies.Login, http => FixedWindow(ClientIp(http), permits: 10));
            options.AddPolicy(RateLimitPolicies.Admin, http => FixedWindow(UserKey(http), permits: 120));
            options.AddPolicy(RateLimitPolicies.Uploads, http => FixedWindow(UserKey(http), permits: 20));
        });

        return services;
    }

    private static RateLimitPartition<string> FixedWindow(string key, int permits) =>
        RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = permits,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        });

    private static string ClientIp(HttpContext http) =>
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    // Logged-in users are counted by user ID; anyone else by IP
    private static string UserKey(HttpContext http) =>
        http.User.FindFirstValue(ClaimTypes.NameIdentifier) is { } id ? $"user:{id}" : $"ip:{ClientIp(http)}";
}