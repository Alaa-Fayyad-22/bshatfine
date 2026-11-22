using System.Security.Claims;
using Bshatfine.Application.Abstractions;
using Bshatfine.Application.Security;
using Bshatfine.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Bshatfine.Api.Security;
using Bshatfine.Domain.Common;

namespace Bshatfine.Api.Endpoints;

public record LoginRequest(string Email, string Password);
public record RegisterRequest(string Email, string Password, string DisplayName);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public record TwoFactorCodeRequest(string Code);

public static class AuthEndpoints
{
    private const string InvalidLogin = "Invalid email or password.";
    private const string TooManyAttempts = "Too many failed attempts. Try again in 15 minutes.";

    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth");

        // ---------- Login, step 1: password ----------
        group.MapPost("/login", async (LoginRequest request, UserManager<AppUser> users, HttpContext http,
            SignInManager<AppUser> signIn, IAuditLogger audit, IExclusiveLock exclusive, CancellationToken ct) =>
        {
            var email = (request.Email ?? string.Empty).Trim();

            AppUser? user;
            SignInResult result;
            try
            {
                // Logins for the SAME email run one at a time, so parallel wrong passwords are all
                // counted and the lockout always happens. The user is loaded INSIDE the lock, so it
                // always sees the failed-attempt count the previous attempt just saved.
                (user, result) = await exclusive.RunAsync($"login:{users.NormalizeEmail(email)}", async () =>
                {
                    var found = await users.FindByEmailAsync(email);
                    if (found is null || !found.IsActive)
                        return (found, SignInResult.Failed);

                    var signInResult = await signIn.PasswordSignInAsync(
                        found, request.Password ?? string.Empty, isPersistent: false, lockoutOnFailure: true);

                    return (found, signInResult);
                }, ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                // Should not happen with the lock; if it ever does, it is a failed login, never a 500
                await audit.LogAsync(new AuditEvent(AuditActions.LoginFailed,
                    Details: new { reason = "concurrent_attempt" }, UserEmail: email), ct);

                return Results.Problem(InvalidLogin, statusCode: StatusCodes.Status401Unauthorized);
            }

            // Unknown email or disabled account: the SAME answer as a wrong password
            if (user is null || !user.IsActive)
            {
                // AUDIT: the log keeps the real reason; the user only sees the generic message
                await audit.LogAsync(new AuditEvent(AuditActions.LoginFailed,
                    Details: new { reason = user is null ? "unknown_email" : "inactive" },
                    UserId: user?.Id,
                    UserEmail: request.Email), ct);

                return Results.Problem(InvalidLogin, statusCode: StatusCodes.Status401Unauthorized);
            }

            if (result.Succeeded)
            {
                // AUDIT
                await audit.LogAsync(new AuditEvent(AuditActions.LoginSucceeded,
                    UserId: user.Id, UserEmail: user.Email), ct);

                return Results.Ok(new { requiresTwoFactor = false });
            }

            if (result.RequiresTwoFactor)
                return Results.Ok(new { requiresTwoFactor = true });

            if (result.IsLockedOut)
            {
                await audit.LogAsync(new AuditEvent(AuditActions.LoginLockedOut,
                    UserId: user.Id, UserEmail: user.Email), ct);

                // Tell the client exactly how long the lock lasts
                var lockoutEnd = await users.GetLockoutEndDateAsync(user);
                var seconds = lockoutEnd is { } end
                    ? Math.Max(1, (int)Math.Ceiling((end - DateTimeOffset.UtcNow).TotalSeconds))
                    : 900;
                http.Response.Headers.RetryAfter = seconds.ToString();

                return Results.Problem(TooManyAttempts, statusCode: StatusCodes.Status429TooManyRequests);
            }

            // AUDIT
            await audit.LogAsync(new AuditEvent(AuditActions.LoginFailed,
                Details: new { reason = "wrong_password" },
                UserId: user.Id, UserEmail: user.Email), ct);

            return Results.Problem(InvalidLogin, statusCode: StatusCodes.Status401Unauthorized);
        }).AllowAnonymous().RequireRateLimiting(RateLimitPolicies.Login);

        // ---------- Login, step 2: authenticator code ----------
        group.MapPost("/login/2fa", async (TwoFactorCodeRequest request, SignInManager<AppUser> signIn) =>
        {
            var result = await signIn.TwoFactorAuthenticatorSignInAsync(
                NormalizeCode(request.Code), isPersistent: false, rememberClient: false);

            if (result.Succeeded)
                return Results.Ok(new { signedIn = true });

            if (result.IsLockedOut)
                return Results.Problem(TooManyAttempts, statusCode: StatusCodes.Status429TooManyRequests);

            return Results.Problem("Invalid code.", statusCode: StatusCodes.Status401Unauthorized);
        }).AllowAnonymous().RequireRateLimiting(RateLimitPolicies.Login);

        // ---------- Login, step 2 (alternative): recovery code ----------
        group.MapPost("/login/recovery", async (TwoFactorCodeRequest request, SignInManager<AppUser> signIn) =>
        {
            var result = await signIn.TwoFactorRecoveryCodeSignInAsync(NormalizeCode(request.Code));

            if (result.Succeeded)
                return Results.Ok(new { signedIn = true });

            if (result.IsLockedOut)
                return Results.Problem(TooManyAttempts, statusCode: StatusCodes.Status429TooManyRequests);

            return Results.Problem("Invalid recovery code.", statusCode: StatusCodes.Status401Unauthorized);
        }).AllowAnonymous().RequireRateLimiting(RateLimitPolicies.Login);

        // ---------- Logout ----------
        group.MapPost("/logout", async (ClaimsPrincipal principal, SignInManager<AppUser> signIn,
            IAuditLogger audit, CancellationToken ct) =>
        {
            // AUDIT: log BEFORE signing out, while we still know who the user is
            if (principal.Identity?.IsAuthenticated == true)
                await audit.LogAsync(new AuditEvent(AuditActions.Logout), ct);

            await signIn.SignOutAsync();
            return Results.NoContent();
        }).AllowAnonymous();

        // ---------- Who am I ----------
        group.MapGet("/me", async (ClaimsPrincipal principal, UserManager<AppUser> users) =>
        {
            var user = await users.GetUserAsync(principal);
            if (user is null)
                return Results.Unauthorized();

            return Results.Ok(new
            {
                user.Id,
                user.Email,
                user.DisplayName,
                Roles = principal.FindAll(ClaimTypes.Role).Select(c => c.Value),
                user.MustChangePassword,
                user.TwoFactorEnabled,
                MfaVerified = principal.HasClaim("amr", "mfa")
            });
        }).RequireAuthorization();

        // ---------- 2FA setup: get the secret key ----------
        group.MapGet("/2fa/setup", async (ClaimsPrincipal principal, UserManager<AppUser> users, SignInManager<AppUser> signIn) =>
        {
            var user = await users.GetUserAsync(principal);
            if (user is null)
                return Results.Unauthorized();

            if (user.TwoFactorEnabled)
                return Results.Problem("Two-factor authentication is already enabled.",
                    statusCode: StatusCodes.Status400BadRequest);

            var key = await users.GetAuthenticatorKeyAsync(user);
            if (string.IsNullOrEmpty(key))
            {
                await users.ResetAuthenticatorKeyAsync(user);
                await signIn.RefreshSignInAsync(user); // the reset changed the security stamp; keep this session valid
                key = await users.GetAuthenticatorKeyAsync(user);
            }

            var issuer = Uri.EscapeDataString("Bshatfine Municipality");
            var account = Uri.EscapeDataString(user.Email!);
            var authenticatorUri = $"otpauth://totp/{issuer}:{account}?secret={key}&issuer={issuer}&digits=6";

            return Results.Ok(new { sharedKey = key, authenticatorUri });
        }).RequireAuthorization();

        // ---------- 2FA setup: confirm with a code, then enable ----------
        group.MapPost("/2fa/enable", async (TwoFactorCodeRequest request, ClaimsPrincipal principal,
            UserManager<AppUser> users, SignInManager<AppUser> signIn) =>
        {
            var user = await users.GetUserAsync(principal);
            if (user is null)
                return Results.Unauthorized();

            if (user.TwoFactorEnabled)
                return Results.Problem("Two-factor authentication is already enabled.",
                    statusCode: StatusCodes.Status400BadRequest);

            var valid = await users.VerifyTwoFactorTokenAsync(
                user, users.Options.Tokens.AuthenticatorTokenProvider, NormalizeCode(request.Code));

            if (!valid)
                return Results.Problem(
                    "The code is not valid. Check that the time on your phone is correct, and try again.",
                    statusCode: StatusCodes.Status400BadRequest);

            await users.SetTwoFactorEnabledAsync(user, true);
            var recoveryCodes = await users.GenerateNewTwoFactorRecoveryCodesAsync(user, 10);

            // The person just proved they hold the phone: mark this session as MFA-verified
            await signIn.SignInWithClaimsAsync(user, isPersistent: false, [new Claim("amr", "mfa")]);

            return Results.Ok(new { recoveryCodes });
        }).RequireAuthorization();


        // ---------- Change my password (also completes a forced change) ----------
        group.MapPost("/change-password", async (ChangePasswordRequest request, ClaimsPrincipal principal,
            UserManager<AppUser> users, SignInManager<AppUser> signIn, IAuditLogger audit, CancellationToken ct) =>
        {
            var user = await users.GetUserAsync(principal);
            if (user is null)
                return Results.Unauthorized();

            if (string.Equals(request.CurrentPassword, request.NewPassword, StringComparison.Ordinal))
                return Results.Problem("The new password must be different from the current one.",
                    statusCode: StatusCodes.Status400BadRequest);

            var result = await users.ChangePasswordAsync(
                user, request.CurrentPassword ?? string.Empty, request.NewPassword ?? string.Empty);

            if (!result.Succeeded)
                return Results.Problem(string.Join(" ", result.Errors.Select(e => e.Description)),
                    statusCode: StatusCodes.Status400BadRequest);

            user.MustChangePassword = false;
            await users.UpdateAsync(user);

            // The password change updated the security stamp: issue a fresh session without the flag
            await signIn.RefreshSignInAsync(user);

            await audit.LogAsync(new AuditEvent(AuditActions.PasswordChanged, "User", user.Id.ToString()), ct);
            return Results.NoContent();
        }).RequireAuthorization()
          .RequireRateLimiting(RateLimitPolicies.Login);

        // ---------- Citizen registration (switched off in Phase 1) ----------
        group.MapPost("/register", async (RegisterRequest request, IConfiguration config,
            UserManager<AppUser> users, IAuditLogger audit, CancellationToken ct) =>
        {
            // Switched off: behave exactly like a route that doesn't exist
            if (!config.GetValue<bool>("Auth:RegistrationEnabled"))
                return Results.NotFound();

            // The same answer whether the email is new or already registered
            const string Accepted = "If this email can be used, you will receive a confirmation email.";

            var email = (request.Email ?? string.Empty).Trim();
            var name = (request.DisplayName ?? string.Empty).Trim();

            if (name.Length is 0 or > 100)
                return Results.Problem("Please enter your name (up to 100 characters).",
                    statusCode: StatusCodes.Status400BadRequest);

            if (await users.FindByEmailAsync(email) is not null)
            {
                await audit.LogAsync(new AuditEvent(AuditActions.RegistrationDuplicate, UserEmail: email), ct);
                return Results.Accepted(value: new { message = Accepted });
            }

            var user = new AppUser
            {
                Id = Guid.CreateVersion7(),
                UserName = email,
                Email = email,
                EmailConfirmed = false, // confirmed by email in Phase 2
                DisplayName = name,
                IsActive = true,
                CreatedAt = Clock.UtcNow
            };

            var result = await users.CreateAsync(user, request.Password ?? string.Empty);
            if (!result.Succeeded)
                return Results.Problem(string.Join(" ", result.Errors.Select(e => e.Description)),
                    statusCode: StatusCodes.Status400BadRequest);

            // ALWAYS a Citizen. The request has no role field, so nobody can choose another role.
            await users.AddToRoleAsync(user, Roles.Citizen);

            // TODO (Phase 2): send the email confirmation link here.
            await audit.LogAsync(new AuditEvent(AuditActions.Registered, "User", user.Id.ToString(),
                UserId: user.Id, UserEmail: email), ct);

            return Results.Accepted(value: new { message = Accepted });
        }).AllowAnonymous()
          .RequireRateLimiting(RateLimitPolicies.Register);
    }

    // Codes are often typed with spaces or dashes, like "123 456"
    private static string NormalizeCode(string? code) =>
        (code ?? string.Empty).Replace(" ", string.Empty).Replace("-", string.Empty);
}