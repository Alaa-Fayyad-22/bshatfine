using System.Text;

namespace Bshatfine.Domain.Common;

public static class SlugGenerator
{
    private const int MaxLength = 60;

    private static readonly HashSet<string> StopWords =
        ["the", "a", "an", "of", "on", "in", "and", "to", "for", "will", "is", "are"];

    public static string Generate(string? englishTitle, Guid id)
    {
        var suffix = id.ToString("N")[^4..];

        // 1. No English title → neutral fallback
        if (string.IsNullOrWhiteSpace(englishTitle))
            return $"news-{suffix}";

        // 2. Keep only a–z and 0–9; everything else becomes a space
        var cleaned = new StringBuilder();
        foreach (var c in englishTitle.ToLowerInvariant())
            cleaned.Append(c is >= 'a' and <= 'z' or >= '0' and <= '9' ? c : ' ');

        // 3. Split into words, dropping empty pieces and filler words
        var words = cleaned.ToString()
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(w => !StopWords.Contains(w));

        // 4. Join with '-', stopping before we'd go over MaxLength
        var slug = new StringBuilder();
        foreach (var word in words)
        {
            var needed = slug.Length == 0 ? word.Length : word.Length + 1; // +1 for the '-'
            if (slug.Length + needed > MaxLength)
                break;

            if (slug.Length > 0)
                slug.Append('-');
            slug.Append(word);
        }

        // 5. Nothing usable left (e.g. a title of only symbols) → fallback
        return slug.Length == 0 ? $"news-{suffix}" : $"{slug}-{suffix}";
    }
}