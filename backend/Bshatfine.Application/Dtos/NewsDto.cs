namespace Bshatfine.Application.Dtos;

public record NewsDto(Guid Id, string Slug, string Language, string Title, string Body, DateTime? PublishedAt, string? CoverImageUrl);

public record AdminNewsDto(
    Guid Id,
    string Slug,
    string Status,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    DateTime? PublishedAt,
    List<NewsTranslationDto> Translations,
    string? CoverImageUrl);

public record NewsTranslationDto(
    string Language,
    string Title,
    string Body
    );






public record CreateNewsRequest(List<NewsTranslationDto> Translations);
public record UpdateNewsRequest(List<NewsTranslationDto> Translations);
