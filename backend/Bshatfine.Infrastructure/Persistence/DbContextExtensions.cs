using Bshatfine.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace Bshatfine.Infrastructure.Persistence;

// Shared by every repository that protects edits with a version (PostgreSQL xmin)
internal static class DbContextExtensions
{
    // The version the user loaded: the save only succeeds if the row still has it
    public static void SetExpectedVersion<TEntity>(this AppDbContext db, TEntity entity, uint version)
        where TEntity : class =>
        db.Entry(entity).Property<uint>("Version").OriginalValue = version;

    // Saves, and turns EF's concurrency error into the Application's own exception (409)
    public static async Task SaveChangesOrConflictAsync(this AppDbContext db, string conflictMessage, CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyConflictException(conflictMessage);
        }
    }
}