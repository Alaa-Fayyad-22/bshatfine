using Bshatfine.Domain.Enums;
using Bshatfine.Domain.Exceptions;

namespace Bshatfine.Domain.Entities;

public class News
{

    public Guid Id { get; private set; }
    public NewsStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public DateTime? PublishedAt { get; private set; }
    private readonly List<NewsTranslations> _translations = [];
    public IReadOnlyCollection<NewsTranslations> Translations => _translations;

    // Required by EF Core to create objects when reading from the database
    private News() { }

    public NewsTranslations? GetTranslation(Language language) =>
    _translations.FirstOrDefault(t => t.Language == language);

    public void SetTranslation(Language language, string title, string body)
    {
        if (Status == NewsStatus.Archived)
            throw new DomainException("Archived news cannot be edited.");
        var existing = GetTranslation(language);

        if (existing is not null)
        {
            existing.Update(title, body);
        }
        else
        {
            _translations.Add(NewsTranslations.Create(Id, language, title, body));
        }

        UpdatedAt = DateTime.UtcNow;
    }

    public void RemoveTranslation(Language language)
    {
        if (Status == NewsStatus.Archived)
            throw new DomainException("Archived news cannot be edited.");

        if (language == Language.Ar)
            throw new DomainException("The Arabic translation cannot be removed.");

        var existing = GetTranslation(language);
        if (existing is null)
            return;

        _translations.Remove(existing);
        UpdatedAt = DateTime.UtcNow;
    }

    public static News CreateDraft(IReadOnlyList<(Language Language, string Title, string Body)> translations)
    {
        if (translations.Count == 0)
            throw new DomainException("At least one translation is required.");

        if (translations.Select(t => t.Language).Distinct().Count() != translations.Count)
            throw new DomainException("Each language can only appear once.");

        var news = new News
        {
            Id = Guid.CreateVersion7(),
            Status = NewsStatus.Draft,
            CreatedAt = DateTime.UtcNow
        };

        foreach (var t in translations)
            news._translations.Add(NewsTranslations.Create(news.Id, t.Language, t.Title, t.Body));

        return news;
    }


    public void Publish()
    {
        if (Status == NewsStatus.Published)
            throw new DomainException("News is already published.");

        if (Status == NewsStatus.Archived)
            throw new DomainException("Archived news cannot be published.");

        if (GetTranslation(Language.Ar) is null)
            throw new DomainException("An Arabic translation is required before publishing.");

        Status = NewsStatus.Published;
        var now = DateTime.UtcNow;
        PublishedAt = now;
        UpdatedAt = now;
    }

    public void Archive()
    {
        if (Status == NewsStatus.Archived)
            throw new DomainException("News is already archived.");

        Status = NewsStatus.Archived;
        UpdatedAt = DateTime.UtcNow;
    }
}