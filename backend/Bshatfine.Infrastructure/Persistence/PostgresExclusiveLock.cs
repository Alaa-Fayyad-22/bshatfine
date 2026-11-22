using Bshatfine.Application.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace Bshatfine.Infrastructure.Persistence;

internal sealed class PostgresExclusiveLock(AppDbContext db) : IExclusiveLock
{
    public async Task<T> RunAsync<T>(string lockName, Func<Task<T>> work, CancellationToken ct = default)
    {
        var strategy = db.Database.CreateExecutionStrategy();

        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(ct);

            // Waits here until no other request holds the same lock.
            // The lock is released automatically when the transaction ends.
            await db.Database.ExecuteSqlAsync(
                $"SELECT pg_advisory_xact_lock(hashtext({lockName}))", ct);

            var result = await work();

            await transaction.CommitAsync(ct);
            return result;
        });
    }
}