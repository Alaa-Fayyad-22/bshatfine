using Microsoft.AspNetCore.Identity;

namespace Bshatfine.Infrastructure.Identity;

public class AppUser : IdentityUser<Guid>
{
    public string DisplayName { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
}