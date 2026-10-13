using Bshatfine.Application.Abstractions;
using Bshatfine.Application.Dtos;
using Bshatfine.Domain.Entities;
using Bshatfine.Domain.Enums;
using Bshatfine.Domain.Exceptions;

namespace Bshatfine.Application.Services;

public class NewsService(INewsRepository repository)
{
    // ---------- Public ----------
    public async Task<PagedResult<NewsDto>> GetPublishedAsync(string lang, int page, int pageSize, CancellationToken ct)
    {
        var language = ParseLanguage(lang);
        (page, pageSize) = NormalizePaging(page, pageSize);

        var (items, total) = await repository.GetPublishedAsync(page, pageSize, ct);

        return new PagedResult<NewsDto>(
            items.Select(n => n.ToDto(language)).ToList(),
            page,
            pageSize,
            total);
    }

    public async Task<NewsDto?> GetPublishedByIdAsync(string lang, Guid id, CancellationToken ct)
    {
        var language = ParseLanguage(lang);
        var news = await repository.GetPublishedByIdAsync(id, ct);
        return news?.ToDto(language);
    }


    // ---------- Admin ----------
    public async Task<PagedResult<AdminNewsDto>> GetAllForAdminAsync(int page, int pageSize, CancellationToken ct)
    {
        (page, pageSize) = NormalizePaging(page, pageSize);

        var (items, total) = await repository.GetAllAsync(page, pageSize, ct);

        return new PagedResult<AdminNewsDto>(
            items.Select(n => n.ToAdminDto()).ToList(),
            page,
            pageSize,
            total);
    }

    public async Task<AdminNewsDto?> GetByIdForAdminAsync(Guid id, CancellationToken ct)
    {
        var news = await repository.GetByIdAsync(id, ct);
        return news?.ToAdminDto();
    }

    public async Task<AdminNewsDto> CreateAsync(CreateNewsRequest request, CancellationToken ct)
    {
        var translations = RequireTranslations(request.Translations);

        var news = News.CreateDraft(
    translations
        .Select(t => (ParseLanguage(t.Language), t.Title, t.Body))
        .ToList());

        repository.Add(news);
        await repository.SaveChangesAsync(ct);
        return news.ToAdminDto();
    }

    public Task<AdminNewsDto?> UpdateAsync(Guid id, UpdateNewsRequest request, CancellationToken ct)
    {
        var translations = RequireTranslations(request.Translations);

        return ChangeAsync(id, news =>
        {
            // 1. Add or update every language that was sent
            foreach (var t in translations)
                news.SetTranslation(ParseLanguage(t.Language), t.Title, t.Body);

            // 2. Which languages were sent?
            var sent = translations
                .Select(t => ParseLanguage(t.Language))
                .ToHashSet();

            // 3. Remove the ones that weren't
            var toRemove = news.Translations
                .Where(t => !sent.Contains(t.Language))
                .ToList();

            foreach (var t in toRemove)
                news.RemoveTranslation(t.Language);
        }, ct);
    }

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

    // The list must exist, be non-empty, and contain no null entries
    // (JSON like {"translations":[null]} would otherwise crash with a NullReferenceException).
    private static List<NewsTranslationDto> RequireTranslations(List<NewsTranslationDto>? translations)
    {
        if (translations is null || translations.Count == 0)
            throw new DomainException("At least one translation is required.");
        if (translations.Any(t => t is null))
            throw new DomainException("Translations cannot contain empty entries.");
        return translations;
    }

    // Matches only the enum NAMES (ar, en). Enum.TryParse alone would also accept
    // numbers such as "1", which is not a language code.
    private static Language ParseLanguage(string? code)
    {
        var name = Enum.GetNames<Language>()
            .FirstOrDefault(n => string.Equals(n, code, StringComparison.OrdinalIgnoreCase));
        if (name is not null)
            return Enum.Parse<Language>(name);
        throw new DomainException($"Unsupported language: '{code}'.");
    }

    private static (int Page, int PageSize) NormalizePaging(int page, int pageSize) =>
        (Math.Max(page, 1), Math.Clamp(pageSize, 1, 50));
}