using Bshatfine.Domain.Enums;
using Bshatfine.Domain.Notices;

namespace Bshatfine.Application.Dtos;

public static class NoticeMappings
{
    public static NoticeSummaryDto ToSummaryDto(this Notice notice, Language language, DateTime now)
    {
        var t = PickTranslation(notice, language);
        return new NoticeSummaryDto(
            notice.Id, notice.Category, Code(notice.Priority), notice.ValidFrom, notice.ValidUntil,
            notice.IsExpiredAt(now), Code(t.Language), t.Title, t.Area, notice.PublishedAt);
    }

    public static NoticeDto ToDto(this Notice notice, Language language, DateTime now)
    {
        var t = PickTranslation(notice, language);
        return new NoticeDto(
            notice.Id, notice.Category, Code(notice.Priority), notice.ValidFrom, notice.ValidUntil,
            notice.IsExpiredAt(now), Code(t.Language), t.Title, t.Body, t.Area,
            notice.PublishedAt, notice.UpdatedAt ?? notice.CreatedAt);
    }

    public static AdminNoticeDto ToAdminDto(this Notice notice) =>
        new(
            notice.Id, notice.Category, Code(notice.Priority), notice.ValidFrom, notice.ValidUntil,
            notice.IsPublished, notice.CreatedAt, notice.UpdatedAt, notice.PublishedAt,
            notice.Translations
                .OrderBy(t => t.Language)
                .Select(t => new NoticeTranslationDto(Code(t.Language), t.Title, t.Body, t.Area))
                .ToList(),
            notice.Version);

    // The requested language, otherwise Arabic, otherwise whatever exists
    private static NoticeTranslation PickTranslation(Notice notice, Language language) =>
        notice.Translations.FirstOrDefault(t => t.Language == language)
        ?? notice.Translations.FirstOrDefault(t => t.Language == Language.Ar)
        ?? notice.Translations.First();

    // Enums go to the browser as lowercase codes: "urgent", "ar"
    private static string Code(Enum value) => value.ToString().ToLowerInvariant();
}