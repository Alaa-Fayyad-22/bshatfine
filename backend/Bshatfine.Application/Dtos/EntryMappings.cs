using Bshatfine.Application.Abstractions;
using Bshatfine.Domain.Entries;
using Bshatfine.Domain.Enums;

namespace Bshatfine.Application.Dtos;

public static class EntryMappings
{
    public static EntrySummaryDto ToSummaryDto(this Entry entry, Language language, IFileStorage storage)
    {
        var t = PickTranslation(entry, language);
        return new EntrySummaryDto(
            entry.Id, Code(entry.Kind), entry.Category, CodeOrNull(entry.Status), entry.Year,
            Code(t.Language), t.Title, t.Summary, CoverUrl(entry, storage));
    }

    public static EntryDto ToDto(this Entry entry, Language language, IFileStorage storage)
    {
        var t = PickTranslation(entry, language);
        return new EntryDto(
            entry.Id, Code(entry.Kind), entry.Category, CodeOrNull(entry.Status), entry.Year,
            Code(t.Language), t.Title, t.Summary, t.Body, CoverUrl(entry, storage),
            entry.UpdatedAt ?? entry.CreatedAt);
    }

    public static AdminEntryDto ToAdminDto(this Entry entry, IFileStorage storage) =>
        new(
            entry.Id, Code(entry.Kind), entry.Category, CodeOrNull(entry.Status), entry.Year,
            entry.IsPublished, entry.DisplayOrder, entry.CreatedAt, entry.UpdatedAt, entry.PublishedAt,
            entry.Translations
                .OrderBy(t => t.Language)
                .Select(t => new EntryTranslationDto(Code(t.Language), t.Title, t.Summary, t.Body))
                .ToList(),
            CoverUrl(entry, storage),
            entry.Version);

    // The requested language, otherwise Arabic, otherwise whatever exists
    private static EntryTranslation PickTranslation(Entry entry, Language language) =>
        entry.Translations.FirstOrDefault(t => t.Language == language)
        ?? entry.Translations.FirstOrDefault(t => t.Language == Language.Ar)
        ?? entry.Translations.First();

    // Enums go to the browser as lowercase codes: "project", "completed", "ar"
    private static string Code(Enum value) => value.ToString().ToLowerInvariant();

    private static string? CodeOrNull(Enum? value) => value is null ? null : Code(value);

    private static string? CoverUrl(Entry entry, IFileStorage storage) =>
        entry.CoverImagePath is null ? null : storage.GetPublicUrl(entry.CoverImagePath);
}