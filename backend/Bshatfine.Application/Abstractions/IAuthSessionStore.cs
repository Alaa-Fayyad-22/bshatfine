namespace Bshatfine.Application.Abstractions;

/// <summary>
/// Server-side storage for login sessions. The cookie only carries the session key;
/// deleting the row ends the session, even if someone kept a copy of the cookie.
/// </summary>
public interface IAuthSessionStore
{
    Task SaveAsync(string key, Guid? userId, byte[] data, DateTimeOffset? expiresAt, CancellationToken ct);
    Task<byte[]?> FindAsync(string key, CancellationToken ct);
    Task RemoveAsync(string key, CancellationToken ct);
    Task RemoveExpiredAsync(CancellationToken ct);
}