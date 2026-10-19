using Bshatfine.Domain.Common;
using Bshatfine.Domain.Enums;
using Bshatfine.Domain.Exceptions;

namespace Bshatfine.Domain.Entities;

public class Page
{
    private readonly List<PageTranslation> _translations = [];

    public Guid Id { get; private set; }
    public string Key { get; private set; } = string.Empty;
    public bool IsPublished { get; private set; }
    public string? CoverImagePath { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public DateTime? PublishedAt { get; private set; }
    public uint Version { get; private set; } // concurrency (PostgreSQL xmin)

    public IReadOnlyCollection<PageTranslation> Translations => _translations;

    private Page() { } // for EF Core

    public static Page Create(string key, IReadOnlyList<(Language Language, string Title, string Body)> translations)
    {
        if (!PageKeys.All.Contains(key))
            throw new DomainException($"Unknown page: '{key}'.");
        if (translations.Count == 0)
            throw new DomainException("At least one translation is required.");

        var page = new Page
        {
            Id = Guid.CreateVersion7(),
            Key = key,
            CreatedAt = Clock.UtcNow
        };

        foreach (var (language, title, body) in translations)
            page.AddTranslation(language, title, body);

        return page;
    }

    public void SetTranslation(Language language, string title, string body)
    {
        var existing = _translations.FirstOrDefault(t => t.Language == language);
        if (existing is null)
            AddTranslation(language, title, body);
        else
            existing.Update(title, body);

        Touch();
    }

    public void RemoveTranslation(Language language)
    {
        if (language == Language.Ar && IsPublished)
            throw new DomainException("The Arabic text cannot be removed while the page is published.");

        var existing = _translations.FirstOrDefault(t => t.Language == language)
            ?? throw new DomainException("This translation does not exist.");

        if (_translations.Count == 1)
            throw new DomainException("A page needs at least one translation.");

        _translations.Remove(existing);
        Touch();
    }

    public void Publish()
    {
        if (IsPublished)
            throw new DomainException("The page is already published.");
        if (!_translations.Any(t => t.Language == Language.Ar))
            throw new DomainException("An Arabic text is required before publishing.");

        IsPublished = true;
        PublishedAt ??= Clock.UtcNow; // keep the first publication date
        Touch();
    }

    public void Unpublish()
    {
        if (!IsPublished)
            throw new DomainException("The page is not published.");

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
            throw new DomainException("The page has no cover image.");

        CoverImagePath = null;
        Touch();
    }

    private void AddTranslation(Language language, string title, string body)
    {
        if (_translations.Any(t => t.Language == language))
            throw new DomainException($"A {language} translation already exists.");

        _translations.Add(PageTranslation.Create(Id, language, title, body));
    }

    private void Touch() => UpdatedAt = Clock.UtcNow;
}