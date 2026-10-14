namespace Bshatfine.Application.Abstractions;

public record StoredFileContent(byte[] Data, string ContentType);

public interface IFileStorage
{
    Task<string> SaveAsync(Stream content, string folder, string extension, CancellationToken ct);
    Task DeleteAsync(string key, CancellationToken ct);
    Task<StoredFileContent?> ReadAsync(string key, CancellationToken ct);
    string GetPublicUrl(string key);
}