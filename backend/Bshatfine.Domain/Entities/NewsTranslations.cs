using Bshatfine.Domain.Enums;
using Bshatfine.Domain.Exceptions;

namespace Bshatfine.Domain.Entities;

public class NewsTranslations
{
    // 1. Constants
    public const int TitleMaxLength = 200;

    // 2. Properties
    public Guid Id { get; private set; }
    public Guid NewsId { get; private set; }
    // TODO: Language, Title, Body
    public Language Language { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Body { get; private set; } = string.Empty;

    // 3. Private constructor for EF
    private NewsTranslations() { }

    // 4. Factory method
    internal static NewsTranslations Create(Guid newsId, Language language, string title, string body)
    {
        // TODO: call the validation helper
        // TODO: return a new NewsTranslations with all properties set

        Validate(title, body);

        return new NewsTranslations
        {
            Id = Guid.CreateVersion7(),
            NewsId=newsId,
            Language = language,
            Title = title.Trim(),
            Body = body.Trim(),
        };
    }

    // 5. Behavior
    internal void Update(string title, string body)
    {
        // TODO: call the validation helper
        // TODO: set Title and Body


        Validate(title, body);

        Title = title.Trim();
        Body = body.Trim();
    }

    // 6. Private helpers
    private static void Validate(string title, string body)
    { 
    if (string.IsNullOrWhiteSpace(title))
            throw new DomainException("Title is required.");

        if (title.Trim().Length > TitleMaxLength)
            throw new DomainException($"Title cannot exceed {TitleMaxLength} characters.");

        if (string.IsNullOrWhiteSpace(body))
            throw new DomainException("Body is required.");
    }
}
