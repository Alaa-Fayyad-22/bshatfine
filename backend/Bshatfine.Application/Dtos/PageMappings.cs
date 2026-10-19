using Bshatfine.Application.Abstractions;
using Bshatfine.Domain.Entities;
using Bshatfine.Domain.Enums;

namespace Bshatfine.Application.Dtos;

public static class PageMappings
{
    // The requested language, or the other one if it doesn't exist yet
    public static PageDto ToDto(this Page page, Language language, IFileStorage storage)
    {
        var translation = page.Translations.FirstOrDefault(t => t.Language == language)
            ?? page.Translations.OrderBy(t => t.Language).First();

        return new PageDto(
            page.Key,
            translation.Language.ToString().ToLowerInvariant(),
            translation.Title,
            translation.Body,
            page.UpdatedAt ?? page.CreatedAt,
            CoverUrl(page, storage));
    }

    public static AdminPageDto ToAdminDto(this Page page, IFileStorage storage) =>
        new(
            page.Id,
            page.Key,
            page.IsPublished,
            page.CreatedAt,
            page.UpdatedAt,
            page.PublishedAt,
            page.Translations
                .OrderBy(t => t.Language)
                .Select(t => new PageTranslationDto(t.Language.ToString().ToLowerInvariant(), t.Title, t.Body))
                .ToList(),
            CoverUrl(page, storage),
            page.Version);

    private static string? CoverUrl(Page page, IFileStorage storage) =>
        page.CoverImagePath is null ? null : storage.GetPublicUrl(page.CoverImagePath);
}