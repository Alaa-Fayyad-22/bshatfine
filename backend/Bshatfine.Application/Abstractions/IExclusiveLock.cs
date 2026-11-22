namespace Bshatfine.Application.Abstractions;

/// <summary>
/// Runs work so that only one request at a time can run work with the same lock name.
/// The lock lives in PostgreSQL, so it also holds across several API instances.
/// Everything the work saves is committed together, or not at all.
/// </summary>
public interface IExclusiveLock
{
    Task<T> RunAsync<T>(string lockName, Func<Task<T>> work, CancellationToken ct = default);
}