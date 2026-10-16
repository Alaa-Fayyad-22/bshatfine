using Bshatfine.Domain.Enums;

namespace Bshatfine.Application.Dtos;

// What the public list sends to the browser
public record NewsSummaryDto(
    Guid Id,
    string Slug,
    string Language,
    string Title,
    string Excerpt,
    DateTime? PublishedAt,
    string? CoverImageUrl);

// What the repository reads from the database for the list
public record NewsSummaryRow(
    Guid Id,
    string Slug,
    Language Language,
    string Title,
    string BodyStart,
    DateTime? PublishedAt,
    string? CoverImagePath)
{
    public const int ExcerptLength = 300;
}