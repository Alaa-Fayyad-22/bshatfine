namespace Bshatfine.Infrastructure.Storage;

public class StoredFile
{
    public Guid Id { get; set; }
    public string Folder { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public byte[] Data { get; set; } = [];
    public DateTime CreatedAt { get; set; }
}