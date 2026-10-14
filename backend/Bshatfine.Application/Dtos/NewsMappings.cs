using Bshatfine.Domain.Entities;
using Bshatfine.Domain.Enums;
using Bshatfine.Application.Abstractions;

namespace Bshatfine.Application.Dtos;

public static class NewsMappings
{
    public static NewsDto ToDto(this News news, Language language, IFileStorage storage)
    {
        // Requested language first, then Arabic (always present on published news).
        // The DTO reports the language of the text actually returned, so the
        // frontend can tell when it received a fallback.
        var translation = news.GetTranslation(language)
            ?? news.GetTranslation(Language.Ar)
            ?? news.Translations.First();
        return new NewsDto(
            news.Id,
            news.Slug,
            translation.Language.ToString().ToLowerInvariant(),
            translation.Title,
            translation.Body,
            news.PublishedAt,
            news.CoverImagePath is null ? null : storage.GetPublicUrl(news.CoverImagePath));
    }

    public static AdminNewsDto ToAdminDto(this News news, IFileStorage storage) =>
    new(news.Id,
        news.Slug,
        news.Status.ToString(),
        news.CreatedAt,
        news.UpdatedAt,
        news.PublishedAt,
        news.Translations
        .OrderBy(t => t.Language)
            .Select(t => new NewsTranslationDto(
                t.Language.ToString().ToLowerInvariant(),
                t.Title,
                t.Body))
            .ToList(),
        news.CoverImagePath is null ? null : storage.GetPublicUrl(news.CoverImagePath));
}