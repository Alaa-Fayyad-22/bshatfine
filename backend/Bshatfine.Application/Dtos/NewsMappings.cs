using Bshatfine.Domain.Entities;
using Bshatfine.Domain.Enums;

namespace Bshatfine.Application.Dtos;

public static class NewsMappings
{
    public static NewsDto ToDto(this News news, Language language)
    {
        var translation = news.GetTranslation(language) ?? news.GetTranslation(Language.En);
        return new NewsDto(
            news.Id,
            language.ToString().ToLowerInvariant(),
            translation!.Title,
            translation.Body,
            news.PublishedAt);
    }

    public static AdminNewsDto ToAdminDto(this News news) =>
    new(news.Id,
        news.Status.ToString(),
        news.CreatedAt,
        news.UpdatedAt,
        news.PublishedAt,
        news.Translations
            .Select(t => new NewsTranslationDto(
                t.Language.ToString().ToLowerInvariant(),
                t.Title,
                t.Body))
            .ToList());
}