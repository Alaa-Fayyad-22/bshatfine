namespace Bshatfine.Infrastructure.Identity;

public class AuthSession
{
    public string Key { get; set; } = string.Empty;   // random, 64 hex characters
    public Guid? UserId { get; set; }                  // whose session it is
    public byte[] Data { get; set; } = [];             // the encrypted session
    public DateTimeOffset? ExpiresAt { get; set; }     // idle expiry, moved forward while in use
    public DateTimeOffset UpdatedAt { get; set; }
}
