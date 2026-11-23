using Bshatfine.Domain.Common;
using Bshatfine.Domain.Enums;
using Bshatfine.Domain.Exceptions;

namespace Bshatfine.Domain.Events;

public class Event
{
    public static readonly IReadOnlyList<string> Categories =
        ["cultural", "religious", "sports", "municipal-meeting", "health", "other"];

    public const int MinYear = 2000;
    public const int MaxYear = 2100;
    public const int MapUrlMaxLength = 500;

    // An event without an end time stays in "Upcoming" this long after it starts
    public static readonly TimeSpan DefaultDuration = TimeSpan.FromHours(3);
    private static readonly TimeSpan MaxDuration = TimeSpan.FromDays(366);

    private readonly List<EventTranslation> _translations = [];

    public Guid Id { get; private set; }
    public string Category { get; private set; } = string.Empty;
    public DateTime StartsAt { get; private set; }   // UTC
    public DateTime? EndsAt { get; private set; }    // UTC; for all-day events: the start of the last day
    public bool IsAllDay { get; private set; }
    public DateTime FinishesAt { get; private set; } // UTC; when the event moves to "Past events"
    public string? MapUrl { get; private set; }
    public string? CoverImagePath { get; private set; }
    public bool IsPublished { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public DateTime? PublishedAt { get; private set; }
    public uint Version { get; private set; } // concurrency (PostgreSQL xmin)

    public IReadOnlyCollection<EventTranslation> Translations => _translations;

    private Event() { } // for EF Core

    public static Event Create(
        IReadOnlyList<(Language Language, EventText Text)> translations,
        string? category, DateTime startsAt, DateTime? endsAt, bool isAllDay, string? mapUrl)
    {
        if (translations.Count == 0)
            throw new DomainException("At least one translation is required.");

        var ev = new Event
        {
            Id = Guid.CreateVersion7(),
            CreatedAt = Clock.UtcNow
        };

        ev.ApplyDetails(category, startsAt, endsAt, isAllDay, mapUrl);
        foreach (var (language, text) in translations)
            ev.AddTranslation(language, text);

        return ev;
    }

    // ---------- Category, schedule, map ----------
    public void UpdateDetails(string? category, DateTime startsAt, DateTime? endsAt, bool isAllDay, string? mapUrl)
    {
        ApplyDetails(category, startsAt, endsAt, isAllDay, mapUrl);
        Touch();
    }

    private void ApplyDetails(string? category, DateTime startsAt, DateTime? endsAt, bool isAllDay, string? mapUrl)
    {
        Category = NormalizeCategory(category);
        ApplySchedule(startsAt, endsAt, isAllDay);
        MapUrl = NormalizeMapUrl(mapUrl);
    }

    private void ApplySchedule(DateTime startsAt, DateTime? endsAt, bool isAllDay)
    {
        RequireUtc(startsAt);
        if (endsAt is { } end)
            RequireUtc(end);

        if (startsAt.Year is < MinYear or > MaxYear)
            throw new DomainException($"The start date must be between {MinYear} and {MaxYear}.");

        if (endsAt is { } e)
        {
            // All-day: the end is the last day (it may be the same day). Timed: strictly after the start.
            var valid = isAllDay ? e >= startsAt : e > startsAt;
            if (!valid)
                throw new DomainException("The end must be after the start.");
            if (e - startsAt > MaxDuration)
                throw new DomainException("An event cannot last longer than a year.");
        }

        StartsAt = startsAt;
        EndsAt = endsAt;
        IsAllDay = isAllDay;

        // The one place that decides when an event becomes a past event
        FinishesAt = (endsAt, isAllDay) switch
        {
            ({ } last, true) => last.AddDays(1),            // until the end of its last day
            ({ } finish, false) => finish,
            (null, true) => startsAt.AddDays(1),            // until the end of that day
            (null, false) => startsAt.Add(DefaultDuration)
        };
    }

    // API dates arrive as UTC; anything else is a programming error, not user input
    private static void RequireUtc(DateTime value)
    {
        if (value.Kind != DateTimeKind.Utc)
            throw new ArgumentException("Event dates must be in UTC.", nameof(value));
    }

    private static string NormalizeCategory(string? category)
    {
        var clean = (category ?? string.Empty).Trim().ToLowerInvariant();
        if (clean.Length == 0)
            throw new DomainException("The category is required.");
        if (!Categories.Contains(clean))
            throw new DomainException($"Unknown category: '{category}'. Allowed: {string.Join(", ", Categories)}.");
        return clean;
    }

    private static string? NormalizeMapUrl(string? mapUrl)
    {
        var clean = (mapUrl ?? string.Empty).Trim();
        if (clean.Length == 0)
            return null;

        if (clean.Length > MapUrlMaxLength)
            throw new DomainException($"The map link cannot exceed {MapUrlMaxLength} characters.");

        // https only, and no characters that could break out of an HTML attribute
        if (!Uri.TryCreate(clean, UriKind.Absolute, out var uri)
            || uri.Scheme != Uri.UriSchemeHttps
            || clean.IndexOfAny(['"', '\'', '<', '>', ' ']) >= 0)
            throw new DomainException("The map link must be a valid https:// address.");

        return clean;
    }

    // ---------- Translations ----------
    public void SetTranslation(Language language, EventText text)
    {
        var existing = _translations.FirstOrDefault(t => t.Language == language);
        if (existing is null)
            AddTranslation(language, text);
        else
            existing.Update(text);
        Touch();
    }

    public void RemoveTranslation(Language language)
    {
        if (language == Language.Ar && IsPublished)
            throw new DomainException("The Arabic text cannot be removed while the event is published.");

        var existing = _translations.FirstOrDefault(t => t.Language == language)
            ?? throw new DomainException("This translation does not exist.");
        if (_translations.Count == 1)
            throw new DomainException("An event needs at least one translation.");

        _translations.Remove(existing);
        Touch();
    }

    private void AddTranslation(Language language, EventText text)
    {
        if (_translations.Any(t => t.Language == language))
            throw new DomainException($"A {language} translation already exists.");
        _translations.Add(EventTranslation.Create(Id, language, text));
    }

    // ---------- Publishing, cover, delete ----------
    public void Publish()
    {
        if (IsPublished)
            throw new DomainException("The event is already published.");
        if (!_translations.Any(t => t.Language == Language.Ar))
            throw new DomainException("An Arabic text is required before publishing.");

        IsPublished = true;
        PublishedAt ??= Clock.UtcNow; // keep the first publication date
        Touch();
    }

    public void Unpublish()
    {
        if (!IsPublished)
            throw new DomainException("The event is not published.");
        IsPublished = false;
        Touch();
    }

    public void SetCoverImage(string storageKey)
    {
        CoverImagePath = storageKey;
        Touch();
    }

    public void RemoveCoverImage()
    {
        if (CoverImagePath is null)
            throw new DomainException("The event has no cover image.");
        CoverImagePath = null;
        Touch();
    }

    public void EnsureCanBeDeleted()
    {
        if (IsPublished)
            throw new DomainException("Unpublish the event before deleting it.");
    }

    private void Touch() => UpdatedAt = Clock.UtcNow;
}