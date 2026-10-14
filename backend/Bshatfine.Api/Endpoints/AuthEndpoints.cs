using System.Security.Claims;
using Bshatfine.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;

namespace Bshatfine.Api.Endpoints;

public record LoginRequest(string Email, string Password);

public static class AuthEndpoints
{
    private const string InvalidLogin = "Invalid email or password.";

    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth");

        group.MapPost("/login", async (LoginRequest request, UserManager<AppUser> users, SignInManager<AppUser> signIn) =>
        {
            var user = await users.FindByEmailAsync(request.Email ?? string.Empty);

            // Unknown email or disabled account: the SAME answer as a wrong password
            if (user is null || !user.IsActive)
                return Results.Problem(InvalidLogin, statusCode: StatusCodes.Status401Unauthorized);

            var result = await signIn.PasswordSignInAsync(
                user, request.Password ?? string.Empty, isPersistent: false, lockoutOnFailure: true);

            if (result.Succeeded)
                return Results.Ok(new { requiresTwoFactor = false });

            if (result.RequiresTwoFactor)
                return Results.Ok(new { requiresTwoFactor = true });

            if (result.IsLockedOut)
                return Results.Problem(
                    "Too many failed attempts. Try again in 15 minutes.",
                    statusCode: StatusCodes.Status429TooManyRequests);

            return Results.Problem(InvalidLogin, statusCode: StatusCodes.Status401Unauthorized);
        });

        group.MapPost("/logout", async (SignInManager<AppUser> signIn) =>
        {
            await signIn.SignOutAsync();
            return Results.NoContent();
        });

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
                user.TwoFactorEnabled
            });
        }).RequireAuthorization();
    }
}