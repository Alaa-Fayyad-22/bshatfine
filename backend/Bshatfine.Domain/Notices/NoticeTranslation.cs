using Bshatfine.Domain.Enums;
using Bshatfine.Domain.Exceptions;

namespace Bshatfine.Domain.Notices;

public class NoticeTranslation
{
    public const int TitleMaxLength = 200;
    public const int BodyMaxLength = 2_000; // notices are short and practical
    public const int AreaMaxLength = 200;

    public Guid Id { get; private set; }
    public Guid NoticeId { get; private set; }
    public Language Language { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Body { get; private set; } = string.Empty; // optional: may be empty
    public string Area { get; private set; } = string.Empty; // optional: may be empty

    private NoticeTranslation() { } // for EF Core

    internal static NoticeTranslation Create(Guid noticeId, Language language, NoticeText text)
    {
        var translation = new NoticeTranslation { Id = Guid.CreateVersion7(), NoticeId = noticeId, Language = language };
        translation.Update(text);
        return translation;
    }

    internal void Update(NoticeText text)
    {
        Title = Required(text.Title, "title", TitleMaxLength);
        Body = Optional(text.Body, "text", BodyMaxLength);
        Area = Optional(text.Area, "area", AreaMaxLength);
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