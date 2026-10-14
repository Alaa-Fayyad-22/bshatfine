using System.Security.Claims;
using Bshatfine.Application.Security;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace Bshatfine.Infrastructure.Identity;

// Adds our own claims to the session when someone logs in
public class AppUserClaimsPrincipalFactory(
    UserManager<AppUser> userManager,
    RoleManager<IdentityRole<Guid>> roleManager,
    IOptions<IdentityOptions> options)
    : UserClaimsPrincipalFactory<AppUser, IdentityRole<Guid>>(userManager, roleManager, options)
{
    protected override async Task<ClaimsIdentity> GenerateClaimsAsync(AppUser user)
    {
        var identity = await base.GenerateClaimsAsync(user);

        if (user.MustChangePassword)
            identity.AddClaim(new Claim(CustomClaims.MustChangePassword, "true"));

        return identity;
    }
}