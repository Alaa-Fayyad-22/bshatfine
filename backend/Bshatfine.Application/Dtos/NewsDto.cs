namespace Bshatfine.Application.Dtos;

public record NewsDto(Guid Id, string Title, string Body, DateTime? PublishedAt);

public record AdminNewsDto(
    Guid Id,
    string Title,
    string Body,
    string Status,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    DateTime? PublishedAt);



public record CreateNewsRequest(string Title, string Body);
public record UpdateNewsRequest(string Title, string Body);