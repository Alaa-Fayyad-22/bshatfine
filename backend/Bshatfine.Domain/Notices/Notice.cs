using Bshatfine.Domain.Common;
using Bshatfine.Domain.Enums;
using Bshatfine.Domain.Exceptions;

namespace Bshatfine.Domain.Notices;

public class Notice
{
    public static readonly IReadOnlyList<string> Categories =
        ["water", "electricity", "roads", "waste", "fees", "council", "health", "general"];

    public const int MinYear = 2000;
    public const int MaxYear = 2100;
    private static readonly TimeSpan MaxValidity = TimeSpan.FromDays(366);

    private readonly List<NoticeTranslation> _translations = [];

    public Guid Id { get; private set; }
    public string Category { get; private set; } = string.Empty;
    public NoticePriority Priority { get; private set; }
    public DateTime? ValidFrom { get; private set; }  // UTC; shown as "from ...", does not hide the notice before it
    public DateTime? ValidUntil { get; private set; } // UTC; after this moment the notice is in the archive
    public bool IsPublished { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public DateTime? PublishedAt { get; private set; }
    public uint Version { get; private set; } // concurrency (PostgreSQL xmin)

    public IReadOnlyCollection<NoticeTranslation> Translations => _translations;

    private Notice() { } // for EF Core

    public static Notice Create(
        IReadOnlyList<(Language Language, NoticeText Text)> translations,
        string? category, NoticePriority priority, DateTime? validFrom, DateTime? validUntil)
    {
        if (translations.Count == 0)
            throw new DomainException("At least one translation is required.");

        var notice = new Notice
        {
            Id = Guid.CreateVersion7(),
            CreatedAt = Clock.UtcNow
        };

        notice.ApplyDetails(category, priority, validFrom, validUntil);
        foreach (var (language, text) in translations)
            notice.AddTranslation(language, text);

        return notice;
    }

    // Active = still current; expired notices are shown in the archive
    public bool IsExpiredAt(DateTime now) => ValidUntil is { } until && until < now;

    // ---------- Category, priority, validity ----------
    public void UpdateDetails(string? category, NoticePriority priority, DateTime? validFrom, DateTime? validUntil)
    {
        ApplyDetails(category, priority, validFrom, validUntil);
        Touch();
    }

    private void ApplyDetails(string? category, NoticePriority priority, DateTime? validFrom, DateTime? validUntil)
    {
        Category = NormalizeCategory(category);

        if (!Enum.IsDefined(priority))
            throw new DomainException("Unknown priority.");
        Priority = priority;

        RequireUtcAndYear(validFrom, "start");
        RequireUtcAndYear(validUntil, "end");

        if (validFrom is { } from && validUntil is { } until)
        {
            if (until <= from)
                throw new DomainException("The end must be after the start.");
            if (until - from > MaxValidity)
                throw new DomainException("A notice cannot be valid for longer than a year.");
        }

        ValidFrom = validFrom;
        ValidUntil = validUntil;
    }

    // API dates arrive as UTC; anything else is a programming error, not user input
    private static void RequireUtcAndYear(DateTime? value, string label)
    {
        if (value is not { } v)
            return;
        if (v.Kind != DateTimeKind.Utc)
            throw new ArgumentException("Notice dates must be in UTC.", nameof(value));
        if (v.Year is < MinYear or > MaxYear)
            throw new DomainException($"The {label} date must be between {MinYear} and {MaxYear}.");
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

    // ---------- Translations ----------
    public void SetTranslation(Language language, NoticeText text)
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
            throw new DomainException("The Arabic text cannot be removed while the notice is published.");

        var existing = _translations.FirstOrDefault(t => t.Language == language)
            ?? throw new DomainException("This translation does not exist.");
        if (_translations.Count == 1)
            throw new DomainException("A notice needs at least one translation.");

        _translations.Remove(existing);
        Touch();
    }

    private void AddTranslation(Language language, NoticeText text)
    {
        if (_translations.Any(t => t.Language == language))
            throw new DomainException($"A {language} translation already exists.");
        _translations.Add(NoticeTranslation.Create(Id, language, text));
    }

    // ---------- Publishing, delete ----------
    public void Publish()
    {
        if (IsPublished)
            throw new DomainException("The notice is already published.");
        if (!_translations.Any(t => t.Language == Language.Ar))
            throw new DomainException("An Arabic text is required before publishing.");

        IsPublished = true;
        PublishedAt ??= Clock.UtcNow; // keep the first publication date
        Touch();
    }

    public void Unpublish()
    {
        if (!IsPublished)
            throw new DomainException("The notice is not published.");
        IsPublished = false;
        Touch();
    }

    public void EnsureCanBeDeleted()
    {
        if (IsPublished)
            throw new DomainException("Unpublish the notice before deleting it.");
    }

    private void Touch() => UpdatedAt = Clock.UtcNow;
}