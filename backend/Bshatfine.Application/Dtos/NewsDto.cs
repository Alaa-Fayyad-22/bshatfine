namespace Bshatfine.Application.Dtos;

public record NewsDto(Guid Id, string Title, string Body, DateTime PublishedAt);

public record CreateNewsRequest(string Title, string Body);