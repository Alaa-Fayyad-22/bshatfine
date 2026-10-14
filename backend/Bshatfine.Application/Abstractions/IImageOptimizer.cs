namespace Bshatfine.Application.Abstractions;

public interface IImageOptimizer
{
    // Returns an optimized WebP image, or null if the input can't be decoded as an image.
    Task<Stream?> OptimizeAsync(Stream input, CancellationToken ct);
}