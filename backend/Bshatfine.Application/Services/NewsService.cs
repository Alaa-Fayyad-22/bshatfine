using Bshatfine.Application.Abstractions;
using Bshatfine.Application.Dtos;
using Bshatfine.Domain.Entities;
using Bshatfine.Domain.Enums;
using Bshatfine.Domain.Exceptions;

namespace Bshatfine.Application.Services;

public class NewsService(INewsRepository repository)
{
    // ---------- Public ----------
    public async Task<List<NewsDto>> GetPublishedAsync(string lang, int page, int pageSize, CancellationToken ct)
    {
        var language = ParseLanguage(lang);
        (page, pageSize) = NormalizePaging(page, pageSize);
        var items = await repository.GetPublishedAsync(page, pageSize, ct);
        return items.Select(n => n.ToDto(language)).ToList();
    }

    public async Task<NewsDto?> GetPublishedByIdAsync(string lang, Guid id, CancellationToken ct)
    {
        var language = ParseLanguage(lang);
        var news = await repository.GetPublishedByIdAsync(id, ct);
        return news?.ToDto(language);
    }

    // ---------- Admin ----------
    public async Task<List<AdminNewsDto>> GetAllForAdminAsync(int page, int pageSize, CancellationToken ct)
    {
        (page, pageSize) = NormalizePaging(page, pageSize);
        var items = await repository.GetAllAsync(page, pageSize, ct);
        return items.Select(n => n.ToAdminDto()).ToList();
    }

    public async Task<AdminNewsDto?> GetByIdForAdminAsync(Guid id, CancellationToken ct)
    {
        var news = await repository.GetByIdAsync(id, ct);
        return news?.ToAdminDto();
    }

    public async Task<AdminNewsDto> CreateAsync(CreateNewsRequest request, CancellationToken ct)
    {
        if (request.Translations.Count == 0)
            throw new DomainException("At least one translation is required.");

        var first = request.Translations[0];
        var news = News.CreateDraft(ParseLanguage(first.Language), first.Title, first.Body);

        foreach (var t in request.Translations.Skip(1))
            news.SetTranslation(ParseLanguage(t.Language), t.Title, t.Body);

        repository.Add(news);
        await repository.SaveChangesAsync(ct);
        return news.ToAdminDto();
    }

    public Task<AdminNewsDto?> UpdateAsync(Guid id, UpdateNewsRequest request, CancellationToken ct) =>
    ChangeAsync(id, news =>
    {
        foreach (var t in request.Translations)
            news.SetTranslation(ParseLanguage(t.Language), t.Title, t.Body);
    }, ct);

    public Task<AdminNewsDto?> PublishAsync(Guid id, CancellationToken ct) =>
        ChangeAsync(id, news => news.Publish(), ct);

    public Task<AdminNewsDto?> ArchiveAsync(Guid id, CancellationToken ct) =>
        ChangeAsync(id, news => news.Archive(), ct);

    // ---------- Helpers ----------
    private async Task<AdminNewsDto?> ChangeAsync(Guid id, Action<News> change, CancellationToken ct)
    {
        var news = await repository.GetByIdAsync(id, ct);
        if (news is null)
            return null;

        change(news);
        await repository.SaveChangesAsync(ct);
        return news.ToAdminDto();
    }

    private static Language ParseLanguage(string code)
    {
        if (Enum.TryParse<Language>(code, ignoreCase: true, out var language)
    && Enum.IsDefined(language))
            return language;
        throw new DomainException($"Unsupported language: '{code}'.");
    }

    private static (int Page, int PageSize) NormalizePaging(int page, int pageSize) =>
        (Math.Max(page, 1), Math.Clamp(pageSize, 1, 50));
}