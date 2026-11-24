namespace Bshatfine.Application.Dtos;

// ---------- Public ----------
// For lists, the home panel and the urgent banner. Dates are UTC; the website shows them in Beirut time.
public record NoticeSummaryDto(
    Guid Id,
    string Category,
    string Priority,
    DateTime? ValidFrom,
    DateTime? ValidUntil,
    bool IsExpired,
    string Language,
    string Title,
    string Area,
    DateTime? PublishedAt);

// For one notice's own page: everything, including the text
public record NoticeDto(
    Guid Id,
    string Category,
    string Priority,
    DateTime? ValidFrom,
    DateTime? ValidUntil,
    bool IsExpired,
    string Language,
    string Title,
    string Body,
    string Area,
    DateTime? PublishedAt,
    DateTime? UpdatedAt);

// ---------- Admin ----------
public record NoticeTranslationDto(string Language, string Title, string? Body, string? Area);

public record AdminNoticeDto(
    Guid Id,
    string Category,
    string Priority,
    DateTime? ValidFrom,
    DateTime? ValidUntil,
    bool IsPublished,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    DateTime? PublishedAt,
    List<NoticeTranslationDto> Translations,
    uint Version);

// Dates with a time zone (e.g. "2026-12-20T08:00:00+02:00"); both are optional
public record CreateNoticeRequest(
    List<NoticeTranslationDto> Translations,
    string? Category,
    string? Priority,
    DateTimeOffset? ValidFrom,
    DateTimeOffset? ValidUntil);

public record UpdateNoticeRequest(
    List<NoticeTranslationDto> Translations,
    string? Category,
    string? Priority,
    DateTimeOffset? ValidFrom,
    DateTimeOffset? ValidUntil,
    uint? Version);