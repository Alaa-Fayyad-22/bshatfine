using Bshatfine.Application.Abstractions;
using Bshatfine.Application.Common;
using Bshatfine.Application.Dtos;
using Bshatfine.Application.Images;
using Bshatfine.Application.Security;
using Bshatfine.Domain.Entities;
using Bshatfine.Domain.Enums;
using Bshatfine.Domain.Exceptions;

namespace Bshatfine.Application.Services;

public class NewsService(INewsRepository repository, IFileStorage storage,
    CoverImageService coverImages, IAuditLogger audit)
{
    private const string EntityType = "News";

    // ---------- Public ----------
    public async Task<PagedResult<NewsSummaryDto>> GetPublishedAsync(string lang, int page, int pageSize, CancellationToken ct)
    {
        var language = ParseLanguage(lang);
        (page, pageSize) = NormalizePaging(page, pageSize);

        var (rows, total) = await repository.GetPublishedSummariesAsync(language, page, pageSize, ct);

        var items = rows
            .Select(r => new NewsSummaryDto(
                r.Id,
                r.Slug,
                r.Language.ToString().ToLowerInvariant(),
                r.Title,
                MakeExcerpt(r.BodyStart),
                r.PublishedAt,
                r.CoverImagePath is null ? null : storage.GetPublicUrl(r.CoverImagePath)))
            .ToList();

        return new PagedResult<NewsSummaryDto>(items, page, pageSize, total);
    }

    public async Task<NewsDto?> GetPublishedByIdAsync(string lang, Guid id, CancellationToken ct)
    {
        var language = ParseLanguage(lang);
        var news = await repository.GetPublishedByIdAsync(id, ct);
        return news?.ToDto(language, storage);
    }

    public async Task<NewsDto?> GetPublishedBySlugAsync(string lang, string slug, CancellationToken ct)
    {
        var language = ParseLanguage(lang);
        var news = await repository.GetPublishedBySlugAsync(slug, ct);
        return news?.ToDto(language, storage);
    }

    // ---------- Admin: reading ----------
    public async Task<PagedResult<AdminNewsDto>> GetAllForAdminAsync(
        int page, int pageSize, string? status, CancellationToken ct)
    {
        (page, pageSize) = NormalizePaging(page, pageSize);

        NewsStatus? statusFilter = string.IsNullOrWhiteSpace(status)
            ? null
            : EnumParsing.ParseName<NewsStatus>(status, "status");

        var (items, total) = await repository.GetAllAsync(page, pageSize, statusFilter, ct);

        return new PagedResult<AdminNewsDto>(
            items.Select(n => n.ToAdminDto(storage)).ToList(),
            page,
            pageSize,
            total);
    }

    public async Task<AdminNewsDto?> GetByIdForAdminAsync(Guid id, CancellationToken ct)
    {
        var news = await repository.GetByIdAsync(id, ct);
        return news?.ToAdminDto(storage);
    }

    // ---------- Admin: changes (each one is audited) ----------
    public async Task<AdminNewsDto> CreateAsync(CreateNewsRequest request, CancellationToken ct)
    {
        var translations = RequireTranslations(request.Translations);

        var news = News.CreateDraft(
            translations
                .Select(t => (ParseLanguage(t.Language), t.Title, t.Body))
                .ToList());

        repository.Add(news);
        await repository.SaveChangesAsync(ct);
        await audit.LogAsync(new AuditEvent(AuditActions.NewsCreated, EntityType, news.Id.ToString()), ct);

        return news.ToAdminDto(storage);
    }

    public Task<AdminNewsDto?> UpdateAsync(Guid id, UpdateNewsRequest request, CancellationToken ct)
    {
        if (request.Version is not { } version)
            throw new DomainException("The article version is required. Reload the page and try again.");

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
        }, AuditActions.NewsUpdated, ct, expectedVersion: version);
    }

    public Task<AdminNewsDto?> PublishAsync(Guid id, CancellationToken ct) =>
        ChangeAsync(id, news => news.Publish(), AuditActions.NewsPublished, ct);

    public Task<AdminNewsDto?> ArchiveAsync(Guid id, CancellationToken ct) =>
        ChangeAsync(id, news => news.Archive(), AuditActions.NewsArchived, ct);

    public Task<AdminNewsDto?> RepublishAsync(Guid id, CancellationToken ct) =>
        ChangeAsync(id, news => news.Republish(), AuditActions.NewsRepublished, ct);

    public async Task<AdminNewsDto?> SetCoverImageAsync(Guid id, Stream content, long length, CancellationToken ct)
    {
        var news = await repository.GetByIdAsync(id, ct);
        if (news is null)
            return null;

        // Validate, convert to WebP and store (shared with pages and, later, the council)
        var newKey = await coverImages.SaveAsync(content, length, "news", ct);
        var oldKey = news.CoverImagePath;

        try
        {
            news.SetCoverImage(newKey);
            await repository.SaveChangesAsync(ct);
        }
        catch
        {
            await storage.DeleteAsync(newKey, ct); // don't leave an orphan file behind
            throw;
        }

        if (oldKey is not null)
            await storage.DeleteAsync(oldKey, ct);

        await audit.LogAsync(new AuditEvent(AuditActions.NewsCoverSet, EntityType, news.Id.ToString()), ct);

        return news.ToAdminDto(storage);
    }

    public async Task<AdminNewsDto?> RemoveCoverImageAsync(Guid id, CancellationToken ct)
    {
        var news = await repository.GetByIdAsync(id, ct);
        if (news is null)
            return null;

        var oldKey = news.CoverImagePath;
        news.RemoveCoverImage();
        await repository.SaveChangesAsync(ct);

        if (oldKey is not null)
            await storage.DeleteAsync(oldKey, ct);

        await audit.LogAsync(new AuditEvent(AuditActions.NewsCoverRemoved, EntityType, news.Id.ToString()), ct);

        return news.ToAdminDto(storage);
    }

    // Returns false if the article doesn't exist
    public async Task<bool> DeleteDraftAsync(Guid id, CancellationToken ct)
    {
        var news = await repository.GetByIdAsync(id, ct);
        if (news is null)
            return false;

        news.EnsureCanBeDeleted();

        // Remember what we need before the article is gone
        var coverKey = news.CoverImagePath;
        var title = news.Translations.OrderBy(t => t.Language).First().Title;

        repository.Remove(news);
        await repository.SaveChangesAsync(ct);

        // Delete the photo only after the article is gone from the database
        if (coverKey is not null)
            await storage.DeleteAsync(coverKey, ct);

        await audit.LogAsync(new AuditEvent(AuditActions.NewsDeleted, EntityType, id.ToString(),
            Details: new { title }), ct);

        return true;
    }

    // ---------- Helpers ----------
    private async Task<AdminNewsDto?> ChangeAsync(Guid id, Action<News> change, string auditAction,
        CancellationToken ct, uint? expectedVersion = null)
    {
        var news = await repository.GetByIdAsync(id, ct);
        if (news is null)
            return null;

        if (expectedVersion is { } version)
            repository.SetExpectedVersion(news, version);

        change(news);
        await repository.SaveChangesAsync(ct);
        await audit.LogAsync(new AuditEvent(auditAction, EntityType, news.Id.ToString()), ct);

        return news.ToAdminDto(storage);
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

    // Cut at the last whole word, and add "…" only if the body was actually longer
    private static string MakeExcerpt(string bodyStart)
    {
        if (bodyStart.Length <= NewsSummaryRow.ExcerptLength)
            return bodyStart;

        var text = bodyStart[..NewsSummaryRow.ExcerptLength];
        var lastSpace = text.LastIndexOf(' ');
        return (lastSpace > 0 ? text[..lastSpace] : text).TrimEnd() + "…";
    }

    private static Language ParseLanguage(string? code) => EnumParsing.ParseName<Language>(code, "language");

    private static (int Page, int PageSize) NormalizePaging(int page, int pageSize) =>
        (Math.Max(page, 1), Math.Clamp(pageSize, 1, 50));
}