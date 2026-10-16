using Bshatfine.Application.Abstractions;
using Bshatfine.Application.Dtos;
using Bshatfine.Application.Images;
using Bshatfine.Application.Security;
using Bshatfine.Domain.Entities;
using Bshatfine.Domain.Enums;
using Bshatfine.Domain.Exceptions;

namespace Bshatfine.Application.Services;

public class NewsService(INewsRepository repository, IFileStorage storage,
    IImageOptimizer imageOptimizer, IAuditLogger audit)
{
    private const string EntityType = "News";

    // ---------- Public ----------
    public async Task<PagedResult<NewsDto>> GetPublishedAsync(string lang, int page, int pageSize, CancellationToken ct)
    {
        var language = ParseLanguage(lang);
        (page, pageSize) = NormalizePaging(page, pageSize);

        var (items, total) = await repository.GetPublishedAsync(page, pageSize, ct);

        return new PagedResult<NewsDto>(
            items.Select(n => n.ToDto(language, storage)).ToList(),
            page,
            pageSize,
            total);
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
                    : ParseEnumName<NewsStatus>(status, "status");

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
        }, AuditActions.NewsUpdated, ct);
    }

    public Task<AdminNewsDto?> PublishAsync(Guid id, CancellationToken ct) =>
        ChangeAsync(id, news => news.Publish(), AuditActions.NewsPublished, ct);

    public Task<AdminNewsDto?> ArchiveAsync(Guid id, CancellationToken ct) =>
        ChangeAsync(id, news => news.Archive(), AuditActions.NewsArchived, ct);

    public Task<AdminNewsDto?> RepublishAsync(Guid id, CancellationToken ct) =>
        ChangeAsync(id, news => news.Republish(), AuditActions.NewsRepublished, ct);

    public async Task<AdminNewsDto?> SetCoverImageAsync(Guid id, Stream content, long length, CancellationToken ct)
    {
        if (length == 0)
            throw new DomainException("The image file is empty.");
        if (length > ImageValidator.MaxBytes)
            throw new DomainException("The image must be 10 MB or smaller.");

        var news = await repository.GetByIdAsync(id, ct);
        if (news is null)
            return null;

        // Read the upload into memory (max 10 MB), then inspect its first bytes
        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, ct);
        if (buffer.Length > ImageValidator.MaxBytes)
            throw new DomainException("The image must be 10 MB or smaller.");

        var header = buffer.GetBuffer().AsSpan(0, (int)Math.Min(buffer.Length, 12));
        _ = ImageValidator.DetectExtension(header)
            ?? throw new DomainException("Only JPEG, PNG or WebP images are allowed.");

        buffer.Position = 0;
        await using var optimized = await imageOptimizer.OptimizeAsync(buffer, ct)
            ?? throw new DomainException("The image could not be read. Please upload a valid JPEG, PNG or WebP image.");

        var newKey = await storage.SaveAsync(optimized, "news", ".webp", ct);
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
    private async Task<AdminNewsDto?> ChangeAsync(Guid id, Action<News> change, string auditAction, CancellationToken ct)
    {
        var news = await repository.GetByIdAsync(id, ct);
        if (news is null)
            return null;

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

    


    // Matches only the enum NAMES, case-insensitively (ar, EN, Draft, published).
    // Enum.TryParse alone would also accept numbers such as "1".
    private static TEnum ParseEnumName<TEnum>(string? value, string label) where TEnum : struct, Enum
    {
        var name = Enum.GetNames<TEnum>()
            .FirstOrDefault(n => string.Equals(n, value, StringComparison.OrdinalIgnoreCase));
        if (name is not null)
            return Enum.Parse<TEnum>(name);
        throw new DomainException($"Unsupported {label}: '{value}'.");
    }

    private static Language ParseLanguage(string? code) => ParseEnumName<Language>(code, "language");

    private static (int Page, int PageSize) NormalizePaging(int page, int pageSize) =>
        (Math.Max(page, 1), Math.Clamp(pageSize, 1, 50));
}