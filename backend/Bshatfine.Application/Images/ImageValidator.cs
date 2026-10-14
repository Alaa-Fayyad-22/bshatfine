namespace Bshatfine.Application.Images;

public static class ImageValidator
{
    public const long MaxBytes = 5 * 1024 * 1024; // 5 MB

    // Returns the extension for a supported image, or null if the bytes aren't one.
    public static string? DetectExtension(ReadOnlySpan<byte> header)
    {
        // JPEG: FF D8 FF
        if (header.Length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF)
            return ".jpg";

        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (header.Length >= 8 &&
            header[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }))
            return ".png";

        // WebP: "RIFF" .... "WEBP"
        if (header.Length >= 12 &&
            header[..4].SequenceEqual("RIFF"u8) &&
            header[8..12].SequenceEqual("WEBP"u8))
            return ".webp";

        return null;
    }
}