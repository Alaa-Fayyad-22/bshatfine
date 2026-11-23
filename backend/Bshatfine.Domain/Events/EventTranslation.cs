using Bshatfine.Domain.Enums;
using Bshatfine.Domain.Exceptions;

namespace Bshatfine.Domain.Events;

public class EventTranslation
{
    public const int TitleMaxLength = 200;
    public const int SummaryMaxLength = 400;
    public const int BodyMaxLength = 50_000;
    public const int LocationMaxLength = 200;
    public const int OrganizerMaxLength = 200;

    public Guid Id { get; private set; }
    public Guid EventId { get; private set; }
    public Language Language { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Summary { get; private set; } = string.Empty;
    public string Body { get; private set; } = string.Empty;      // optional: may be empty
    public string Location { get; private set; } = string.Empty;  // optional: may be empty
    public string Organizer { get; private set; } = string.Empty; // optional: may be empty

    private EventTranslation() { } // for EF Core

    internal static EventTranslation Create(Guid eventId, Language language, EventText text)
    {
        var translation = new EventTranslation { Id = Guid.CreateVersion7(), EventId = eventId, Language = language };
        translation.Update(text);
        return translation;
    }

    internal void Update(EventText text)
    {
        Title = Required(text.Title, "title", TitleMaxLength);
        Summary = Required(text.Summary, "summary", SummaryMaxLength);
        Body = Optional(text.Body, "text", BodyMaxLength);
        Location = Optional(text.Location, "location", LocationMaxLength);
        Organizer = Optional(text.Organizer, "organizer", OrganizerMaxLength);
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

    private static string Optional(string? value, string label, int maxLength)
    {
        var clean = (value ?? string.Empty).Trim();
        if (clean.Length > maxLength)
            throw new DomainException($"The {label} cannot exceed {maxLength:N0} characters.");
        return clean;
    }
}