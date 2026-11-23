using Bshatfine.Application.Abstractions;
using Bshatfine.Application.Dtos;
using Bshatfine.Application.Images;
using Bshatfine.Application.Security;
using Bshatfine.Application.Common;
using Bshatfine.Domain.Common;
using Bshatfine.Domain.Enums;
using Bshatfine.Domain.Events;
using Bshatfine.Domain.Exceptions;

namespace Bshatfine.Application.Services;

public class EventService(IEventRepository repository, IFileStorage storage,
    CoverImageService coverImages, IAuditLogger audit)
{
    private const string EntityType = "Event";
    private const string CoverFolder = "events";
    private const int MaxPageSize = 50;

    // ---------- Public ----------
    // Upcoming and ongoing events, soonest first (the home page asks for 3)
    public async Task<List<EventSummaryDto>> GetUpcomingAsync(string lang, int limit, CancellationToken ct)
    {
        var language = ParseLanguage(lang);
        var events = await repository.GetUpcomingAsync(Clock.UtcNow, Math.Clamp(limit, 1, MaxPageSize), ct);
        return events.Select(e => e.ToSummaryDto(language, storage)).ToList();
    }

    // The archive, most recent first
    public async Task<PagedResult<EventSummaryDto>> GetPastAsync(string lang, int page, int pageSize, CancellationToken ct)
    {
        var language = ParseLanguage(lang);
        var (safePage, safeSize) = SafePaging(page, pageSize);

        var (items, total) = await repository.GetPastPageAsync(Clock.UtcNow, safePage, safeSize, ct);
        return new PagedResult<EventSummaryDto>(
            items.Select(e => e.ToSummaryDto(language, storage)).ToList(), safePage, safeSize, total);
    }

    public async Task<EventDto?> GetPublishedByIdAsync(Guid id, string lang, CancellationToken ct)
    {
        var language = ParseLanguage(lang);
        var ev = await repository.GetPublishedByIdAsync(id, ct);
        return ev?.ToDto(language, storage, Clock.UtcNow);
    }

    // ---------- Admin: reading ----------
    public async Task<PagedResult<AdminEventDto>> GetPageForAdminAsync(int page, int pageSize, CancellationToken ct)
    {
        var (safePage, safeSize) = SafePaging(page, pageSize);
        var (items, total) = await repository.GetPageAsync(safePage, safeSize, ct);
        return new PagedResult<AdminEventDto>(
            items.Select(e => e.ToAdminDto(storage)).ToList(), safePage, safeSize, total);
    }

    public async Task<AdminEventDto?> GetForAdminAsync(Guid id, CancellationToken ct)
    {
        var ev = await repository.GetByIdAsync(id, ct);
        return ev?.ToAdminDto(storage);
    }

    // ---------- Admin: changes (each one audited) ----------
    public async Task<AdminEventDto> CreateAsync(CreateEventRequest request, CancellationToken ct)
    {
        var translations = RequireTranslations(request.Translations);

        var ev = Event.Create(
            translations.Select(t => (ParseLanguage(t.Language), ToText(t))).ToList(),
            request.Category, RequireStart(request.StartsAt), ToUtcOrNull(request.EndsAt),
            request.IsAllDay, request.MapUrl);

        repository.Add(ev);
        await repository.SaveChangesAsync(ct);
        await Log(AuditActions.EventCreated, ev, ct);

        return ev.ToAdminDto(storage);
    }

    public Task<AdminEventDto?> UpdateAsync(Guid id, UpdateEventRequest request, CancellationToken ct)
    {
        if (request.Version is not { } version)
            throw new DomainException("The event version is required. Reload the page and try again.");

        var translations = RequireTranslations(request.Translations);
        var startsAt = RequireStart(request.StartsAt);
        var endsAt = ToUtcOrNull(request.EndsAt);

        return ChangeAsync(id, ev =>
        {
            ev.UpdateDetails(request.Category, startsAt, endsAt, request.IsAllDay, request.MapUrl);

            foreach (var t in translations)
                ev.SetTranslation(ParseLanguage(t.Language), ToText(t));

            // Remove the languages that were not sent
            var sent = translations.Select(t => ParseLanguage(t.Language)).ToHashSet();
            foreach (var t in ev.Translations.Where(t => !sent.Contains(t.Language)).ToList())
                ev.RemoveTranslation(t.Language);
        }, AuditActions.EventUpdated, ct, expectedVersion: version);
    }

    public Task<AdminEventDto?> PublishAsync(Guid id, CancellationToken ct) =>
        ChangeAsync(id, e => e.Publish(), AuditActions.EventPublished, ct);

    public Task<AdminEventDto?> UnpublishAsync(Guid id, CancellationToken ct) =>
        ChangeAsync(id, e => e.Unpublish(), AuditActions.EventUnpublished, ct);

    public async Task<AdminEventDto?> SetCoverImageAsync(Guid id, Stream content, long length, CancellationToken ct)
    {
        var ev = await repository.GetByIdAsync(id, ct);
        if (ev is null)
            return null;

        var newKey = await coverImages.SaveAsync(content, length, CoverFolder, ct);
        var oldKey = ev.CoverImagePath;

        try
        {
            ev.SetCoverImage(newKey);
            await repository.SaveChangesAsync(ct);
        }
        catch
        {
            await storage.DeleteAsync(newKey, ct); // don't leave an orphan file behind
            throw;
        }

        if (oldKey is not null)
            await storage.DeleteAsync(oldKey, ct);

        await Log(AuditActions.EventCoverSet, ev, ct);
        return ev.ToAdminDto(storage);
    }

    public async Task<AdminEventDto?> RemoveCoverImageAsync(Guid id, CancellationToken ct)
    {
        var ev = await repository.GetByIdAsync(id, ct);
        if (ev is null)
            return null;

        var oldKey = ev.CoverImagePath;
        ev.RemoveCoverImage();
        await repository.SaveChangesAsync(ct);

        if (oldKey is not null)
            await storage.DeleteAsync(oldKey, ct);

        await Log(AuditActions.EventCoverRemoved, ev, ct);
        return ev.ToAdminDto(storage);
    }

    // Returns false if the event doesn't exist
    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var ev = await repository.GetByIdAsync(id, ct);
        if (ev is null)
            return false;

        ev.EnsureCanBeDeleted();

        // Remember what we need before the event is gone
        var coverKey = ev.CoverImagePath;
        var details = Describe(ev);

        repository.Remove(ev);
        await repository.SaveChangesAsync(ct);

        // Delete the photo only after the event is gone from the database
        if (coverKey is not null)
            await storage.DeleteAsync(coverKey, ct);

        await audit.LogAsync(new AuditEvent(AuditActions.EventDeleted, EntityType, id.ToString(), Details: details), ct);
        return true;
    }

    // ---------- Helpers ----------
    private async Task<AdminEventDto?> ChangeAsync(Guid id, Action<Event> change, string auditAction,
        CancellationToken ct, uint? expectedVersion = null)
    {
        var ev = await repository.GetByIdAsync(id, ct);
        if (ev is null)
            return null;

        if (expectedVersion is { } version)
            repository.SetExpectedVersion(ev, version);

        change(ev);
        await repository.SaveChangesAsync(ct);
        await Log(auditAction, ev, ct);

        return ev.ToAdminDto(storage);
    }

    private Task Log(string action, Event ev, CancellationToken ct) =>
        audit.LogAsync(new AuditEvent(action, EntityType, ev.Id.ToString(), Details: Describe(ev)), ct);

    // What the audit log shows: the (Arabic) title and the start, readable even after a delete
    private static object Describe(Event ev) => new
    {
        title = (ev.Translations.FirstOrDefault(t => t.Language == Language.Ar)
                 ?? ev.Translations.First()).Title,
        startsAt = ev.StartsAt
    };

    private static List<EventTranslationDto> RequireTranslations(List<EventTranslationDto>? translations)
    {
        if (translations is null || translations.Count == 0)
            throw new DomainException("At least one translation is required.");
        if (translations.Any(t => t is null))
            throw new DomainException("Translations cannot contain empty entries.");
        return translations;
    }

    private static EventText ToText(EventTranslationDto t) =>
        new(t.Title, t.Summary, t.Body, t.Location, t.Organizer);

    private static DateTime RequireStart(DateTimeOffset? startsAt) =>
        startsAt is { } value
            ? ToUtc(value)
            : throw new DomainException("The start date and time are required.");

    private static DateTime? ToUtcOrNull(DateTimeOffset? value) => value is { } v ? ToUtc(v) : null;

    // Any time zone in, UTC out, whole seconds (event times never need fractions)
    private static DateTime ToUtc(DateTimeOffset value)
    {
        var utc = value.UtcDateTime;
        return new DateTime(utc.Ticks - utc.Ticks % TimeSpan.TicksPerSecond, DateTimeKind.Utc);
    }

    private static (int Page, int PageSize) SafePaging(int page, int pageSize) =>
        (Math.Max(page, 1), Math.Clamp(pageSize, 1, MaxPageSize));

    private static Language ParseLanguage(string? code) => EnumParsing.ParseName<Language>(code, "language");
}