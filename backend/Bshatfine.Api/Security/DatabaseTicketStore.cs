using System.Security.Claims;
using System.Security.Cryptography;
using Bshatfine.Application.Abstractions;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;

namespace Bshatfine.Api.Security;

/// <summary>
/// Keeps login sessions in the database instead of inside the cookie.
/// The cookie carries only a random key; logout deletes the session row,
/// so a copied cookie stops working immediately.
/// </summary>
public sealed class DatabaseTicketStore(IServiceScopeFactory scopes, IDataProtectionProvider dataProtection) : ITicketStore
{
    // The stored session is encrypted too, with the same Data Protection keys as the cookie
    private readonly IDataProtector protector = dataProtection.CreateProtector("Bshatfine.AuthSessions");

    public async Task<string> StoreAsync(AuthenticationTicket ticket)
    {
        var key = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

        await using var scope = scopes.CreateAsyncScope();
        var sessions = scope.ServiceProvider.GetRequiredService<IAuthSessionStore>();

        await sessions.RemoveExpiredAsync(CancellationToken.None); // housekeeping at each login
        await sessions.SaveAsync(key, UserIdOf(ticket), Protect(ticket), ticket.Properties.ExpiresUtc, CancellationToken.None);
        return key;
    }

    public async Task RenewAsync(string key, AuthenticationTicket ticket)
    {
        await using var scope = scopes.CreateAsyncScope();
        var sessions = scope.ServiceProvider.GetRequiredService<IAuthSessionStore>();
        await sessions.SaveAsync(key, UserIdOf(ticket), Protect(ticket), ticket.Properties.ExpiresUtc, CancellationToken.None);
    }

    public async Task<AuthenticationTicket?> RetrieveAsync(string key)
    {
        await using var scope = scopes.CreateAsyncScope();
        var sessions = scope.ServiceProvider.GetRequiredService<IAuthSessionStore>();

        var data = await sessions.FindAsync(key, CancellationToken.None);
        if (data is null)
            return null; // logged out, expired, or never existed

        try
        {
            return TicketSerializer.Default.Deserialize(protector.Unprotect(data));
        }
        catch (CryptographicException)
        {
            return null; // encrypted with keys that no longer exist: treat as logged out
        }
    }

    public async Task RemoveAsync(string key)
    {
        await using var scope = scopes.CreateAsyncScope();
        var sessions = scope.ServiceProvider.GetRequiredService<IAuthSessionStore>();
        await sessions.RemoveAsync(key, CancellationToken.None);
    }

    private byte[] Protect(AuthenticationTicket ticket) =>
        protector.Protect(TicketSerializer.Default.Serialize(ticket));

    private static Guid? UserIdOf(AuthenticationTicket ticket) =>
        Guid.TryParse(ticket.Principal.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
}