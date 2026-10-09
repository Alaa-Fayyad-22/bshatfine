using Bshatfine.Domain.Enums;
using Bshatfine.Domain.Exceptions;

namespace Bshatfine.Domain.Entities;

public class News
{
    public const int TitleMaxLength = 200;

    public Guid Id { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Body { get; private set; } = string.Empty;
    public NewsStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public DateTime? PublishedAt { get; private set; }

    // Required by EF Core to create objects when reading from the database
    private News() { }

    public static News CreateDraft(string title, string body)
    {
        ValidateContent(title, body);

        return new News
        {
            Id = Guid.CreateVersion7(),
            Title = title.Trim(),
            Body = body.Trim(),
            Status = NewsStatus.Draft,
            CreatedAt = DateTime.UtcNow
        };
    }

    public void Edit(string title, string body)
    {
        if (Status == NewsStatus.Archived)
            throw new DomainException("Archived news cannot be edited.");

        ValidateContent(title, body);

        Title = title.Trim();
        Body = body.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    public void Publish()
    {
        if (Status == NewsStatus.Published)
            throw new DomainException("News is already published.");

        if (Status == NewsStatus.Archived)
            throw new DomainException("Archived news cannot be published.");

        Status = NewsStatus.Published;
        PublishedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Archive()
    {
        if (Status == NewsStatus.Archived)
            throw new DomainException("News is already archived.");

        Status = NewsStatus.Archived;
        UpdatedAt = DateTime.UtcNow;
    }

    private static void ValidateContent(string title, string body)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new DomainException("Title is required.");

        if (title.Trim().Length > TitleMaxLength)
            throw new DomainException($"Title cannot exceed {TitleMaxLength} characters.");

        if (string.IsNullOrWhiteSpace(body))
            throw new DomainException("Body is required.");
    }
}