using Bshatfine.Application.Abstractions;
using Bshatfine.Application.Common;
using Bshatfine.Application.Dtos;
using Bshatfine.Application.Images;
using Bshatfine.Application.Security;
using Bshatfine.Domain.Entities;
using Bshatfine.Domain.Enums;
using Bshatfine.Domain.Exceptions;

namespace Bshatfine.Application.Services;

public class PageService(IPageRepository repository, IFileStorage storage,
    CoverImageService coverImages, IAuditLogger audit)
{
    private const string EntityType = "Page";

    // ---------- Public ----------
    public async Task<PageDto?> GetPublishedAsync(string key, string lang, CancellationToken ct)
    {
        var language = ParseLanguage(lang);
        var page = await repository.GetPublishedByKeyAsync(NormalizeKey(key), ct);
        return page?.ToDto(language, storage);
    }

    // ---------- Admin: reading ----------
    public async Task<List<AdminPageSummaryDto>> GetAllForAdminAsync(CancellationToken ct)
    {
        var existing = (await repository.GetAllAsync(ct)).ToDictionary(p => p.Key);

        // Every known key, whether the page exists yet or not
        return PageKeys.All
            .Order()
            .Select(key => existing.TryGetValue(key, out var page)
                ? new AdminPageSummaryDto(key, true, page.IsPublished,
                    TitleIn(page, Language.Ar), TitleIn(page, Language.En), page.UpdatedAt ?? page.CreatedAt)
                : new AdminPageSummaryDto(key, false, false, null, null, null))
            .ToList();
    }

    public async Task<AdminPageDto?> GetForAdminAsync(string key, CancellationToken ct)
    {
        var page = await repository.GetByKeyAsync(NormalizeKey(key), ct);
        return page?.ToAdminDto(storage);
    }

    // ---------- Admin: changes (each one audited) ----------
    public async Task<AdminPageDto> CreateAsync(CreatePageRequest request, CancellationToken ct)
    {
        var key = NormalizeKey(request.Key);
        var translations = RequireTranslations(request.Translations);

        if (await repository.GetByKeyAsync(key, ct) is not null)
            throw new DomainException("This page already exists.");

        var page = Page.Create(key,
            translations.Select(t => (ParseLanguage(t.Language), t.Title, t.Body)).ToList());

        repository.Add(page);
        await repository.SaveChangesAsync(ct);
        await audit.LogAsync(new AuditEvent(AuditActions.PageCreated, EntityType, key), ct);

        return page.ToAdminDto(storage);
    }

    public Task<AdminPageDto?> UpdateAsync(string key, UpdatePageRequest request, CancellationToken ct)
    {
        if (request.Version is not { } version)
            throw new DomainException("The page version is required. Reload the page and try again.");

        var translations = RequireTranslations(request.Translations);

        return ChangeAsync(key, page =>
        {
            foreach (var t in translations)
                page.SetTranslation(ParseLanguage(t.Language), t.Title, t.Body);

            var sent = translations.Select(t => ParseLanguage(t.Language)).ToHashSet();
            foreach (var t in page.Translations.Where(t => !sent.Contains(t.Language)).ToList())
                page.RemoveTranslation(t.Language);
        }, AuditActions.PageUpdated, ct, expectedVersion: version);
    }

    public Task<AdminPageDto?> PublishAsync(string key, CancellationToken ct) =>
        ChangeAsync(key, page => page.Publish(), AuditActions.PagePublished, ct);

    public Task<AdminPageDto?> UnpublishAsync(string key, CancellationToken ct) =>
        ChangeAsync(key, page => page.Unpublish(), AuditActions.PageUnpublished, ct);

    public async Task<AdminPageDto?> SetCoverImageAsync(string key, Stream content, long length, CancellationToken ct)
    {
        var page = await repository.GetByKeyAsync(NormalizeKey(key), ct);
        if (page is null)
            return null;

        var newKey = await coverImages.SaveAsync(content, length, "pages", ct);
        var oldKey = page.CoverImagePath;

        try
        {
            page.SetCoverImage(newKey);
            await repository.SaveChangesAsync(ct);
        }
        catch
        {
            await storage.DeleteAsync(newKey, ct); // don't leave an orphan file behind
            throw;
        }

        if (oldKey is not null)
            await storage.DeleteAsync(oldKey, ct);

        await audit.LogAsync(new AuditEvent(AuditActions.PageCoverSet, EntityType, page.Key), ct);
        return page.ToAdminDto(storage);
    }

    public async Task<AdminPageDto?> RemoveCoverImageAsync(string key, CancellationToken ct)
    {
        var page = await repository.GetByKeyAsync(NormalizeKey(key), ct);
        if (page is null)
            return null;

        var oldKey = page.CoverImagePath;
        page.RemoveCoverImage();
        await repository.SaveChangesAsync(ct);

        if (oldKey is not null)
            await storage.DeleteAsync(oldKey, ct);

        await audit.LogAsync(new AuditEvent(AuditActions.PageCoverRemoved, EntityType, page.Key), ct);
        return page.ToAdminDto(storage);
    }

    // ---------- Helpers ----------
    private async Task<AdminPageDto?> ChangeAsync(string key, Action<Page> change, string auditAction,
        CancellationToken ct, uint? expectedVersion = null)
    {
        var page = await repository.GetByKeyAsync(NormalizeKey(key), ct);
        if (page is null)
            return null;

        if (expectedVersion is { } version)
            repository.SetExpectedVersion(page, version);

        change(page);
        await repository.SaveChangesAsync(ct);
        await audit.LogAsync(new AuditEvent(auditAction, EntityType, page.Key), ct);

        return page.ToAdminDto(storage);
    }

    private static string NormalizeKey(string? key) => (key ?? string.Empty).Trim().ToLowerInvariant();

    private static string? TitleIn(Page page, Language language) =>
        page.Translations.FirstOrDefault(t => t.Language == language)?.Title;

    private static List<PageTranslationDto> RequireTranslations(List<PageTranslationDto>? translations)
    {
        if (translations is null || translations.Count == 0)
            throw new DomainException("At least one translation is required.");
        if (translations.Any(t => t is null))
            throw new DomainException("Translations cannot contain empty entries.");
        return translations;
    }

    private static Language ParseLanguage(string? code) => EnumParsing.ParseName<Language>(code, "language");
}