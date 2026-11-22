using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Bshatfine.Application.Security;
using Microsoft.AspNetCore.Authorization;
namespace Bshatfine.Api.Security;

public static class AuthenticationSetup
{
    private static readonly TimeSpan IdleTimeout = TimeSpan.FromMinutes(30);
    private static readonly TimeSpan AbsoluteTimeout = TimeSpan.FromHours(8);
    private const string AbsoluteExpiryKey = "absolute_expiry";

    public static IServiceCollection AddBshatfineAuthentication(this IServiceCollection services)
    {
        services
            .AddAuthentication(IdentityConstants.ApplicationScheme)
            .AddIdentityCookies();

        services.ConfigureApplicationCookie(options =>
        {
            options.Cookie.Name = "bsh.session";
            options.Cookie.HttpOnly = true;
            options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
            options.Cookie.SameSite = SameSiteMode.Strict;

            options.ExpireTimeSpan = IdleTimeout;
            options.SlidingExpiration = true;

            // APIs answer with status codes, not redirects to a login page
            options.Events.OnRedirectToLogin = ctx =>
            {
                ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            };
            options.Events.OnRedirectToAccessDenied = ctx =>
            {
                ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                return Task.CompletedTask;
            };

            // At login: record the moment this session must end, whatever happens
            options.Events.OnSigningIn = ctx =>
            {
                ctx.Properties.Items.TryAdd(
                    AbsoluteExpiryKey,
                    DateTimeOffset.UtcNow.Add(AbsoluteTimeout).ToString("O"));
                return Task.CompletedTask;
            };

            // On every request: re-check the account, then enforce the 8-hour limit
            options.Events.OnValidatePrincipal = async ctx =>
            {
                await SecurityStampValidator.ValidatePrincipalAsync(ctx);
                if (ctx.Principal is null)
                    return;

                var expiry = ctx.Properties.Items.TryGetValue(AbsoluteExpiryKey, out var value)
                    && DateTimeOffset.TryParse(value, out var parsed)
                        ? parsed
                        : DateTimeOffset.MinValue;

                if (DateTimeOffset.UtcNow > expiry)
                {
                    ctx.RejectPrincipal();
                    await ctx.HttpContext.SignOutAsync(IdentityConstants.ApplicationScheme);
                }
            };
        });

        // Sessions live in the database; the cookie only carries the session key,
        // so logout really ends the session, even for a copied cookie
        services.AddSingleton<ITicketStore, DatabaseTicketStore>();
        services.AddOptions<CookieAuthenticationOptions>(IdentityConstants.ApplicationScheme)
            .Configure<ITicketStore>((options, store) => options.SessionStore = store);

        // Re-check accounts every minute: disabling an account or forcing a logout
        // takes effect quickly, even for sessions that are already open
        services.Configure<SecurityStampValidatorOptions>(options =>
            options.ValidationInterval = TimeSpan.FromMinutes(1));

        services.AddAuthorizationBuilder()
    // Secure by default: every endpoint requires a logged-in user
    // unless it is explicitly marked AllowAnonymous
    .SetFallbackPolicy(new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build())
        .AddPolicy(Policies.Staff, policy => policy
        .RequireAuthenticatedUser()
        .RequireRole(Roles.Staff)
        .RequireAssertion(ctx => !ctx.User.HasClaim(c => c.Type == CustomClaims.MustChangePassword)))
        // When 2FA is added: .RequireClaim("amr", "mfa")
    .AddPolicy(Policies.AdminOnly, policy => policy
        .RequireAuthenticatedUser()
        .RequireRole(Roles.Admin)
        .RequireAssertion(ctx => !ctx.User.HasClaim(c => c.Type == CustomClaims.MustChangePassword)));
        return services;
    }
}