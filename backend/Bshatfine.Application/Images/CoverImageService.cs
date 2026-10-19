using Bshatfine.Application.Abstractions;
using Bshatfine.Domain.Exceptions;

namespace Bshatfine.Application.Images;

// Validates an uploaded image, converts it to WebP, stores it, and returns the storage key.
public class CoverImageService(IFileStorage storage, IImageOptimizer imageOptimizer)
{
    public async Task<string> SaveAsync(Stream content, long length, string folder, CancellationToken ct)
    {
        if (length == 0)
            throw new DomainException("The image file is empty.");
        if (length > ImageValidator.MaxBytes)
            throw new DomainException("The image must be 10 MB or smaller.");

        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, ct);
        if (buffer.Length > ImageValidator.MaxBytes)
            throw new DomainException("The image must be 10 MB or smaller.");

        var header = buffer.GetBuffer().AsSpan(0, (int)Math.Min(buffer.Length, 12));
        _ = ImageValidator.DetectExtension(header)
            ?? throw new DomainException("Only JPEG, PNG or WebP images are allowed.");

        buffer.Position = 0;
        await using var optimized = await imageOptimizer.OptimizeAsync(buffer, ct)
            ?? throw new DomainException("The image could not be read. Please upload a valid JPEG, PNG or WebP image.");

        return await storage.SaveAsync(optimized, folder, ".webp", ct);
    }
}