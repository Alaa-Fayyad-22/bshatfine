using Bshatfine.Application.Dtos;
using Bshatfine.Application.Security;
using Bshatfine.Application.Services;

namespace Bshatfine.Api.Endpoints.Admin;

public static class AdminSiteSettingsEndpoints
{
    public static void MapAdminSiteSettingsEndpoints(this IEndpointRouteBuilder admin)
    {
        var group = admin.MapGroup("/site-settings").RequireAuthorization(Policies.AdminOnly);

        group.MapGet("/", async (SiteSettingsService service, CancellationToken ct) =>
            Results.Ok(await service.GetForAdminAsync(ct)));

        group.MapPut("/", async (UpdateSiteSettingsRequest request, SiteSettingsService service, CancellationToken ct) =>
            Results.Ok(await service.UpdateAsync(request, ct)));
    }
}