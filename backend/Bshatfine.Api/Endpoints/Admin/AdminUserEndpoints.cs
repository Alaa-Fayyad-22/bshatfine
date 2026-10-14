using System.Security.Claims;
using Bshatfine.Application.Abstractions;
using Bshatfine.Application.Dtos;
using Bshatfine.Application.Security;

namespace Bshatfine.Api.Endpoints.Admin;

public static class AdminUserEndpoints
{
    public static void MapAdminUserEndpoints(this IEndpointRouteBuilder admin)
    {
        var group = admin.MapGroup("/users").RequireAuthorization(Policies.AdminOnly);

        group.MapGet("/", async (IUserAdminService service, CancellationToken ct,
            string? search, string? role, bool? isActive, int page = 1, int pageSize = 20) =>
            Results.Ok(await service.GetPageAsync(new StaffUserFilter(search, role, isActive, page, pageSize), ct)));

        group.MapGet("/{id:guid}", async (Guid id, IUserAdminService service, CancellationToken ct) =>
            await service.GetAsync(id, ct) is { } user ? Results.Ok(user) : Results.NotFound());

        group.MapPost("/", async (CreateStaffUserRequest request, IUserAdminService service, CancellationToken ct) =>
        {
            var created = await service.CreateAsync(request, ct);
            return Results.Created($"/api/admin/users/{created.User.Id}", created);
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateStaffUserRequest request, ClaimsPrincipal principal,
            IUserAdminService service, CancellationToken ct) =>
            await service.UpdateAsync(id, request, ActingUserId(principal), ct) is { } user
                ? Results.Ok(user) : Results.NotFound());

        group.MapPost("/{id:guid}/disable", async (Guid id, ClaimsPrincipal principal,
            IUserAdminService service, CancellationToken ct) =>
            await service.SetActiveAsync(id, false, ActingUserId(principal), ct) is { } user
                ? Results.Ok(user) : Results.NotFound());

        group.MapPost("/{id:guid}/enable", async (Guid id, ClaimsPrincipal principal,
            IUserAdminService service, CancellationToken ct) =>
            await service.SetActiveAsync(id, true, ActingUserId(principal), ct) is { } user
                ? Results.Ok(user) : Results.NotFound());

        group.MapPost("/{id:guid}/reset-password", async (Guid id, IUserAdminService service, CancellationToken ct) =>
            await service.ResetPasswordAsync(id, ct) is { } result ? Results.Ok(result) : Results.NotFound());

        group.MapPost("/{id:guid}/force-logout", async (Guid id, ClaimsPrincipal principal,
            IUserAdminService service, CancellationToken ct) =>
            await service.ForceLogoutAsync(id, ActingUserId(principal), ct) is { } user
                ? Results.Ok(user) : Results.NotFound());

        group.MapPost("/{id:guid}/unlock", async (Guid id, IUserAdminService service, CancellationToken ct) =>
            await service.UnlockAsync(id, ct) is { } user ? Results.Ok(user) : Results.NotFound());
    }

    private static Guid ActingUserId(ClaimsPrincipal principal) =>
        Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
}