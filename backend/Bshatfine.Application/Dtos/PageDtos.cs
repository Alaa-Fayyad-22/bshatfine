namespace Bshatfine.Application.Dtos;

// Public: one page in one language (the requested one, or the fallback)
public record PageDto(
    string Key,
    string Language,
    string Title,
    string Body,
    DateTime? UpdatedAt,
    string? CoverImageUrl);

// Admin: the full page, both languages
public record AdminPageDto(
    Guid Id,
    string Key,
    bool IsPublished,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    DateTime? PublishedAt,
    List<PageTranslationDto> Translations,
    string? CoverImageUrl,
    uint Version);

public record PageTranslationDto(string Language, string Title, string Body);

// Admin list: EVERY known page, including the ones not created yet
public record AdminPageSummaryDto(
    string Key,
    bool Exists,
    bool IsPublished,
    string? ArabicTitle,
    string? EnglishTitle,
    DateTime? UpdatedAt);

public record CreatePageRequest(string Key, List<PageTranslationDto> Translations);

public record UpdatePageRequest(List<PageTranslationDto> Translations, uint? Version);