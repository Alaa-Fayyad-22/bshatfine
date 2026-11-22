using Bshatfine.Application.Abstractions;
using Bshatfine.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Bshatfine.Infrastructure.Identity;

internal sealed class AuthSessionStore(AppDbContext db) : IAuthSessionStore
{
    public async Task SaveAsync(string key, Guid? userId, byte[] data, DateTimeOffset? expiresAt, CancellationToken ct)
    {
        var session = await db.AuthSessions.FindAsync([key], ct);
        if (session is null)
        {
            session = new AuthSession { Key = key };
            db.AuthSessions.Add(session);
        }

        session.UserId = userId;
        session.Data = data;
        session.ExpiresAt = expiresAt;
        session.UpdatedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);
    }

    public async Task<byte[]?> FindAsync(string key, CancellationToken ct) =>
        await db.AuthSessions
            .AsNoTracking()
            .Where(s => s.Key == key && (s.ExpiresAt == null || s.ExpiresAt > DateTimeOffset.UtcNow))
            .Select(s => s.Data)
            .FirstOrDefaultAsync(ct);

    public Task RemoveAsync(string key, CancellationToken ct) =>
        db.AuthSessions.Where(s => s.Key == key).ExecuteDeleteAsync(ct);

    public Task RemoveExpiredAsync(CancellationToken ct) =>
        db.AuthSessions.Where(s => s.ExpiresAt != null && s.ExpiresAt < DateTimeOffset.UtcNow).ExecuteDeleteAsync(ct);
}