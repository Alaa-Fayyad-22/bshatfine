using Bshatfine.Application.Abstractions;
using Bshatfine.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Bshatfine.Infrastructure.Storage;

public class DatabaseFileStorage(AppDbContext db) : IFileStorage
{
    public async Task<string> SaveAsync(Stream content, string folder, string extension, CancellationToken ct)
    {
        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, ct);

        var file = new StoredFile
        {
            Id = Guid.CreateVersion7(),
            Folder = folder,
            ContentType = ContentTypeFor(extension),
            Data = buffer.ToArray(),
            CreatedAt = DateTime.UtcNow
        };

        db.StoredFiles.Add(file);
        await db.SaveChangesAsync(ct);

        return file.Id.ToString();
    }

    public async Task DeleteAsync(string key, CancellationToken ct)
    {
        if (!Guid.TryParse(key, out var id))
            return;

        await db.StoredFiles.Where(f => f.Id == id).ExecuteDeleteAsync(ct);
    }

    public async Task<StoredFileContent?> ReadAsync(string key, CancellationToken ct)
    {
        if (!Guid.TryParse(key, out var id))
            return null;

        return await db.StoredFiles
            .AsNoTracking()
            .Where(f => f.Id == id)
            .Select(f => new StoredFileContent(f.Data, f.ContentType))
            .FirstOrDefaultAsync(ct);
    }

    public string GetPublicUrl(string key) => $"/api/files/{key}";

    private static string ContentTypeFor(string extension) => extension switch
    {
        ".jpg" => "image/jpeg",
        ".png" => "image/png",
        ".webp" => "image/webp",
        _ => "application/octet-stream"
    };
}