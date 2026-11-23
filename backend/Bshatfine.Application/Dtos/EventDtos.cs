namespace Bshatfine.Application.Dtos;

// ---------- Public ----------
// For lists and cards: no long text. Dates are UTC; the website shows them in Beirut time.
public record EventSummaryDto(
    Guid Id,
    string Category,
    DateTime StartsAt,
    DateTime? EndsAt,
    bool IsAllDay,
    string Language,
    string Title,
    string Summary,
    string Location,
    string? CoverImageUrl);

// For one event's own page: everything
public record EventDto(
    Guid Id,
    string Category,
    DateTime StartsAt,
    DateTime? EndsAt,
    bool IsAllDay,
    bool IsPast,
    string Language,
    string Title,
    string Summary,
    string Body,
    string Location,
    string Organizer,
    string? MapUrl,
    string? CoverImageUrl,
    DateTime? UpdatedAt);

// ---------- Admin ----------
public record EventTranslationDto(
    string Language, string Title, string Summary, string? Body, string? Location, string? Organizer);

public record AdminEventDto(
    Guid Id,
    string Category,
    DateTime StartsAt,
    DateTime? EndsAt,
    bool IsAllDay,
    DateTime FinishesAt,
    string? MapUrl,
    bool IsPublished,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    DateTime? PublishedAt,
    List<EventTranslationDto> Translations,
    string? CoverImageUrl,
    uint Version);

// Dates with a time zone (e.g. "2026-12-20T18:00:00+02:00"), so the instant is never ambiguous.
// StartsAt is nullable only so a missing value gives a clear 400 instead of a binding error.
public record CreateEventRequest(
    List<EventTranslationDto> Translations,
    string? Category,
    DateTimeOffset? StartsAt,
    DateTimeOffset? EndsAt,
    bool IsAllDay,
    string? MapUrl);

public record UpdateEventRequest(
    List<EventTranslationDto> Translations,
    string? Category,
    DateTimeOffset? StartsAt,
    DateTimeOffset? EndsAt,
    bool IsAllDay,
    string? MapUrl,
    uint? Version);