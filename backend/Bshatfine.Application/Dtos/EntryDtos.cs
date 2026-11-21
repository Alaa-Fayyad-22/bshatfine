namespace Bshatfine.Application.Dtos;

// ---------- Public ----------
// For lists and cards: no long text
public record EntrySummaryDto(
    Guid Id,
    string Kind,
    string? Category,
    string? Status,
    int? Year,
    string Language,
    string Title,
    string Summary,
    string? CoverImageUrl);

// For one entry's own page: everything, including the text
public record EntryDto(
    Guid Id,
    string Kind,
    string? Category,
    string? Status,
    int? Year,
    string Language,
    string Title,
    string Summary,
    string Body,
    string? CoverImageUrl,
    DateTime? UpdatedAt);

// ---------- Admin ----------
public record EntryTranslationDto(string Language, string Title, string Summary, string? Body);

public record AdminEntryDto(
    Guid Id,
    string Kind,
    string? Category,
    string? Status,
    int? Year,
    bool IsPublished,
    int DisplayOrder,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    DateTime? PublishedAt,
    List<EntryTranslationDto> Translations,
    string? CoverImageUrl,
    uint Version);

public record CreateEntryRequest(
    string Kind,
    List<EntryTranslationDto> Translations,
    string? Category,
    string? Status,
    int? Year);

public record UpdateEntryRequest(
    List<EntryTranslationDto> Translations,
    string? Category,
    string? Status,
    int? Year,
    uint? Version);

// The complete new order of ONE kind: every id of that kind, exactly once
public record ReorderEntriesRequest(List<Guid> Ids);