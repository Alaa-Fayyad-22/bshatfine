using Bshatfine.Application.Abstractions;
using SkiaSharp;

namespace Bshatfine.Infrastructure.Images;

public class SkiaImageOptimizer : IImageOptimizer
{
    private const int MaxSide = 1600;
    private const long MaxPixels = 40_000_000; // ~40 megapixels; refuses "image bombs"
    private const int WebpQuality = 80;

    public Task<Stream?> OptimizeAsync(Stream input, CancellationToken ct)
    {
        using var codec = SKCodec.Create(input);
        if (codec is null)
            return Task.FromResult<Stream?>(null); // not a decodable image

        // Check the size BEFORE decoding: a small file can claim huge dimensions
        if ((long)codec.Info.Width * codec.Info.Height > MaxPixels)
            return Task.FromResult<Stream?>(null);

        using var decoded = SKBitmap.Decode(codec);
        if (decoded is null)
            return Task.FromResult<Stream?>(null);

        using var oriented = ApplyOrientation(decoded, codec.EncodedOrigin);
        var (width, height) = FitInside(oriented.Width, oriented.Height, MaxSide);

        using var resized = oriented.Resize(
            new SKImageInfo(width, height),
            new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.Linear));

        // Re-encoding drops all metadata (EXIF, GPS location, camera details)
        using var image = SKImage.FromBitmap(resized);
        using var data = image.Encode(SKEncodedImageFormat.Webp, WebpQuality);

        return Task.FromResult<Stream?>(new MemoryStream(data.ToArray()));
    }

    // Phone photos are often stored sideways with a "rotate me" note (EXIF orientation)
    private static SKBitmap ApplyOrientation(SKBitmap source, SKEncodedOrigin origin)
    {
        var swapSides = origin is SKEncodedOrigin.RightTop or SKEncodedOrigin.LeftBottom;
        var result = new SKBitmap(
            swapSides ? source.Height : source.Width,
            swapSides ? source.Width : source.Height);

        using var canvas = new SKCanvas(result);
        switch (origin)
        {
            case SKEncodedOrigin.BottomRight: // upside down
                canvas.Translate(result.Width, result.Height);
                canvas.RotateDegrees(180);
                break;
            case SKEncodedOrigin.RightTop:    // rotate 90° clockwise
                canvas.Translate(result.Width, 0);
                canvas.RotateDegrees(90);
                break;
            case SKEncodedOrigin.LeftBottom:  // rotate 90° counter-clockwise
                canvas.Translate(0, result.Height);
                canvas.RotateDegrees(270);
                break;
        }

        canvas.DrawBitmap(source, 0, 0, new SKSamplingOptions(SKFilterMode.Linear));
        return result;
    }

    // Shrink to fit inside max×max, keeping proportions; never enlarge
    private static (int Width, int Height) FitInside(int width, int height, int max)
    {
        var scale = Math.Min(1.0, (double)max / Math.Max(width, height));
        return ((int)Math.Round(width * scale), (int)Math.Round(height * scale));
    }
}