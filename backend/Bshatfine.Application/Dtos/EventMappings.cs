using Bshatfine.Application.Abstractions;
using Bshatfine.Domain.Enums;
using Bshatfine.Domain.Events;

namespace Bshatfine.Application.Dtos;

public static class EventMappings
{
    public static EventSummaryDto ToSummaryDto(this Event ev, Language language, IFileStorage storage)
    {
        var t = PickTranslation(ev, language);
        return new EventSummaryDto(
            ev.Id, ev.Category, ev.StartsAt, ev.EndsAt, ev.IsAllDay,
            Code(t.Language), t.Title, t.Summary, t.Location, CoverUrl(ev, storage));
    }

    public static EventDto ToDto(this Event ev, Language language, IFileStorage storage, DateTime now)
    {
        var t = PickTranslation(ev, language);
        return new EventDto(
            ev.Id, ev.Category, ev.StartsAt, ev.EndsAt, ev.IsAllDay, ev.FinishesAt < now,
            Code(t.Language), t.Title, t.Summary, t.Body, t.Location, t.Organizer,
            ev.MapUrl, CoverUrl(ev, storage), ev.UpdatedAt ?? ev.CreatedAt);
    }

    public static AdminEventDto ToAdminDto(this Event ev, IFileStorage storage) =>
        new(
            ev.Id, ev.Category, ev.StartsAt, ev.EndsAt, ev.IsAllDay, ev.FinishesAt, ev.MapUrl,
            ev.IsPublished, ev.CreatedAt, ev.UpdatedAt, ev.PublishedAt,
            ev.Translations
                .OrderBy(t => t.Language)
                .Select(t => new EventTranslationDto(Code(t.Language), t.Title, t.Summary, t.Body, t.Location, t.Organizer))
                .ToList(),
            CoverUrl(ev, storage),
            ev.Version);

    // The requested language, otherwise Arabic, otherwise whatever exists
    private static EventTranslation PickTranslation(Event ev, Language language) =>
        ev.Translations.FirstOrDefault(t => t.Language == language)
        ?? ev.Translations.FirstOrDefault(t => t.Language == Language.Ar)
        ?? ev.Translations.First();

    // Enums go to the browser as lowercase codes: "ar", "en"
    private static string Code(Enum value) => value.ToString().ToLowerInvariant();

    private static string? CoverUrl(Event ev, IFileStorage storage) =>
        ev.CoverImagePath is null ? null : storage.GetPublicUrl(ev.CoverImagePath);
}