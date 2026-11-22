using System.Net;
using System.Security.Cryptography;
using System.Text;

namespace Bshatfine.Api.Security;

/// <summary>
/// The website's server (Next.js on Vercel) forwards every /api request to this API and adds:
///  - a shared secret, proving the request really came through the website;
///  - the visitor's IP as Vercel saw it (Vercel overwrites X-Forwarded-For, so visitors cannot fake it).
/// When a secret is configured (staging/production):
///  - correct secret + visitor IP: that IP becomes the connection's IP, so rate limiting counts
///    real visitors instead of Vercel's servers;
///  - correct secret, no visitor IP: the website's own server is fetching data to render a page;
///    it is marked so the global limit doesn't block the whole site (see RateLimitingSetup);
///  - no or wrong secret: the request did not come through the website and is refused (403).
/// Without a configured secret (development) nothing changes.
/// </summary>
public static class TrustedProxy
{
    public const string SecretHeader = "X-Bsh-Proxy-Secret";
    public const string ClientIpHeader = "X-Bsh-Client-Ip";
    private const string WebsiteServerItem = "bsh.website-server";

    public static bool IsWebsiteServer(HttpContext http) => http.Items.ContainsKey(WebsiteServerItem);

    public static IApplicationBuilder UseBshatfineTrustedProxy(this IApplicationBuilder app, IConfiguration config)
    {
        var secret = config["ReverseProxy:SharedSecret"];
        if (string.IsNullOrEmpty(secret))
            return app; // development: requests come straight from this PC

        // Compare fixed-length hashes, so neither the content nor the length of the secret
        // can be guessed from response timing
        var expected = SHA256.HashData(Encoding.UTF8.GetBytes(secret));

        return app.Use(async (http, next) =>
        {
            var sent = SHA256.HashData(Encoding.UTF8.GetBytes(http.Request.Headers[SecretHeader].ToString()));

            if (!CryptographicOperations.FixedTimeEquals(sent, expected))
            {
                await Results.Problem("Requests must come through the website.",
                        statusCode: StatusCodes.Status403Forbidden)
                    .ExecuteAsync(http);
                return;
            }

            if (IPAddress.TryParse(http.Request.Headers[ClientIpHeader].ToString(), out var visitor))
                http.Connection.RemoteIpAddress = visitor;
            else
                http.Items[WebsiteServerItem] = true; // the website's own page rendering

            // Used up: nothing after this point sees either header
            http.Request.Headers.Remove(SecretHeader);
            http.Request.Headers.Remove(ClientIpHeader);

            await next();
        });
    }
}