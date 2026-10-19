using Bshatfine.Domain.Enums;
using Bshatfine.Domain.Exceptions;

namespace Bshatfine.Domain.Entities;

public class PageTranslation
{
    public const int TitleMaxLength = 200;
    public const int BodyMaxLength = 50_000;

    public Guid Id { get; private set; }
    public Guid PageId { get; private set; }
    public Language Language { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Body { get; private set; } = string.Empty;

    private PageTranslation() { } // for EF Core

    internal static PageTranslation Create(Guid pageId, Language language, string title, string body)
    {
        var translation = new PageTranslation
        {
            Id = Guid.CreateVersion7(),
            PageId = pageId,
            Language = language
        };
        translation.Update(title, body);
        return translation;
    }

    internal void Update(string title, string body)
    {
        var cleanTitle = (title ?? string.Empty).Trim();
        var cleanBody = (body ?? string.Empty).Trim();

        if (cleanTitle.Length == 0)
            throw new DomainException("The title is required.");
        if (cleanTitle.Length > TitleMaxLength)
            throw new DomainException($"The title cannot exceed {TitleMaxLength} characters.");
        if (cleanBody.Length == 0)
            throw new DomainException("The text is required.");
        if (cleanBody.Length > BodyMaxLength)
            throw new DomainException($"The text cannot exceed {BodyMaxLength:N0} characters.");

        Title = cleanTitle;
        Body = cleanBody;
    }
}