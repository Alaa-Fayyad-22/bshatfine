namespace Bshatfine.Application.Dtos;

public record NewsDto(Guid Id, string Language, string Title, string Body, DateTime? PublishedAt);

public record AdminNewsDto(
    Guid Id,
    string Status,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    DateTime? PublishedAt,
    List<NewsTranslationDto> Translations);

public record NewsTranslationDto(
    string Language,
    string Title,
    string Body
    );






public record CreateNewsRequest(List<NewsTranslationDto> Translations);
public record UpdateNewsRequest(List<NewsTranslationDto> Translations);
