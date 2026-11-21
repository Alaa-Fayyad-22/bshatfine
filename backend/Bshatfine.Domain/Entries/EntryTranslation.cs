using Bshatfine.Domain.Enums;
using Bshatfine.Domain.Exceptions;

namespace Bshatfine.Domain.Entries;

public class EntryTranslation
{
    public const int TitleMaxLength = 200;
    public const int SummaryMaxLength = 400;
    public const int BodyMaxLength = 50_000;

    public Guid Id { get; private set; }
    public Guid EntryId { get; private set; }
    public Language Language { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Summary { get; private set; } = string.Empty;
    public string Body { get; private set; } = string.Empty; // optional: may be empty

    private EntryTranslation() { } // for EF Core

    internal static EntryTranslation Create(Guid entryId, Language language, string title, string summary, string? body)
    {
        var translation = new EntryTranslation { Id = Guid.CreateVersion7(), EntryId = entryId, Language = language };
        translation.Update(title, summary, body);
        return translation;
    }

    internal void Update(string title, string summary, string? body)
    {
        Title = Required(title, "title", TitleMaxLength);
        Summary = Required(summary, "summary", SummaryMaxLength);

        var cleanBody = (body ?? string.Empty).Trim();
        if (cleanBody.Length > BodyMaxLength)
            throw new DomainException($"The text cannot exceed {BodyMaxLength:N0} characters.");
        Body = cleanBody;
    }

    private static string Required(string? value, string label, int maxLength)
    {
        var clean = (value ?? string.Empty).Trim();
        if (clean.Length == 0)
            throw new DomainException($"The {label} is required.");
        if (clean.Length > maxLength)
            throw new DomainException($"The {label} cannot exceed {maxLength:N0} characters.");
        return clean;
    }
}