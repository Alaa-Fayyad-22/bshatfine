using Bshatfine.Domain.Common;
using Bshatfine.Domain.Enums;
using Bshatfine.Domain.Exceptions;

namespace Bshatfine.Domain.Entries;

public class Entry
{
    public const int MinYear = 1000;
    public const int MaxYear = 2100;

    private readonly List<EntryTranslation> _translations = [];

    public Guid Id { get; private set; }
    public EntryKind Kind { get; private set; }
    public string? Category { get; private set; }
    public ProjectStatus? Status { get; private set; }
    public int? Year { get; private set; }
    public string? CoverImagePath { get; private set; }
    public int DisplayOrder { get; private set; }
    public bool IsPublished { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public DateTime? PublishedAt { get; private set; }
    public uint Version { get; private set; } // concurrency (PostgreSQL xmin)

    public IReadOnlyCollection<EntryTranslation> Translations => _translations;

    private Entry() { } // for EF Core

    public static Entry Create(
        EntryKind kind,
        IReadOnlyList<(Language Language, string Title, string Summary, string? Body)> translations,
        string? category, ProjectStatus? status, int? year, int displayOrder)
    {
        if (translations.Count == 0)
            throw new DomainException("At least one translation is required.");

        var entry = new Entry
        {
            Id = Guid.CreateVersion7(),
            Kind = kind,
            DisplayOrder = Math.Max(displayOrder, 0),
            CreatedAt = Clock.UtcNow
        };

        entry.ApplyDetails(category, status, year);
        foreach (var (language, title, summary, body) in translations)
            entry.AddTranslation(language, title, summary, body);

        return entry;
    }

    // ---------- Details that depend on the kind ----------
    public void UpdateDetails(string? category, ProjectStatus? status, int? year)
    {
        ApplyDetails(category, status, year);
        Touch();
    }

    private void ApplyDetails(string? category, ProjectStatus? status, int? year)
    {
        var rule = EntryKindRules.For(Kind);

        Category = rule.UsesCategory
            ? NormalizeCategory(category, rule)
            : string.IsNullOrWhiteSpace(category) ? null : throw new DomainException($"A {Kind} entry has no category.");

        Status = rule.UsesStatus
            ? status ?? throw new DomainException("The status is required.")
            : status is null ? null : throw new DomainException($"A {Kind} entry has no status.");

        Year = (rule.UsesYear, year) switch
        {
            (_, null) => null,
            (true, >= MinYear and <= MaxYear) => year,
            (true, _) => throw new DomainException($"The year must be between {MinYear} and {MaxYear}."),
            (false, _) => throw new DomainException($"A {Kind} entry has no year.")
        };
    }

    private static string NormalizeCategory(string? category, KindRule rule)
    {
        var clean = (category ?? string.Empty).Trim().ToLowerInvariant();
        if (clean.Length == 0)
            throw new DomainException("The category is required.");
        if (!rule.Categories.Contains(clean))
            throw new DomainException($"Unknown category: '{category}'. Allowed: {string.Join(", ", rule.Categories)}.");
        return clean;
    }

    // ---------- Translations ----------
    public void SetTranslation(Language language, string title, string summary, string? body)
    {
        var existing = _translations.FirstOrDefault(t => t.Language == language);
        if (existing is null)
            AddTranslation(language, title, summary, body);
        else
            existing.Update(title, summary, body);
        Touch();
    }

    public void RemoveTranslation(Language language)
    {
        if (language == Language.Ar && IsPublished)
            throw new DomainException("The Arabic text cannot be removed while the entry is published.");

        var existing = _translations.FirstOrDefault(t => t.Language == language)
            ?? throw new DomainException("This translation does not exist.");
        if (_translations.Count == 1)
            throw new DomainException("An entry needs at least one translation.");

        _translations.Remove(existing);
        Touch();
    }

    private void AddTranslation(Language language, string title, string summary, string? body)
    {
        if (_translations.Any(t => t.Language == language))
            throw new DomainException($"A {language} translation already exists.");
        _translations.Add(EntryTranslation.Create(Id, language, title, summary, body));
    }

    // ---------- Publishing, order, cover, delete ----------
    public void Publish()
    {
        if (IsPublished)
            throw new DomainException("The entry is already published.");
        if (!_translations.Any(t => t.Language == Language.Ar))
            throw new DomainException("An Arabic text is required before publishing.");

        IsPublished = true;
        PublishedAt ??= Clock.UtcNow; // keep the first publication date
        Touch();
    }

    public void Unpublish()
    {
        if (!IsPublished)
            throw new DomainException("The entry is not published.");
        IsPublished = false;
        Touch();
    }

    public void SetDisplayOrder(int displayOrder)
    {
        DisplayOrder = Math.Max(displayOrder, 0);
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
            throw new DomainException("The entry has no cover image.");
        CoverImagePath = null;
        Touch();
    }

    public void EnsureCanBeDeleted()
    {
        if (IsPublished)
            throw new DomainException("Unpublish the entry before deleting it.");
    }

    private void Touch() => UpdatedAt = Clock.UtcNow;
}