using Bshatfine.Application.Abstractions;
using Bshatfine.Application.Dtos;
using Bshatfine.Application.Security;
using Bshatfine.Application.Common;
using Bshatfine.Domain.Common;
using Bshatfine.Domain.Enums;
using Bshatfine.Domain.Exceptions;
using Bshatfine.Domain.Notices;

namespace Bshatfine.Application.Services;

public class NoticeService(INoticeRepository repository, IAuditLogger audit)
{
    private const string EntityType = "Notice";
    private const int MaxPageSize = 50;
    private const int MaxUrgent = 5; // the banner never shows more than a handful

    // ---------- Public ----------
    // Active notices, urgent first: the notices page (all) and the home panel (a few)
    public async Task<List<NoticeSummaryDto>> GetActiveAsync(string lang, string? category, int limit, CancellationToken ct)
    {
        var language = ParseLanguage(lang);
        var now = Clock.UtcNow;
        var notices = await repository.GetActiveAsync(now, ParseCategoryFilter(category), null, Math.Clamp(limit, 1, MaxPageSize), ct);
        return notices.Select(n => n.ToSummaryDto(language, now)).ToList();
    }

    // Active urgent notices, for the banner on every page
    public async Task<List<NoticeSummaryDto>> GetUrgentAsync(string lang, CancellationToken ct)
    {
        var language = ParseLanguage(lang);
        var now = Clock.UtcNow;
        var notices = await repository.GetActiveAsync(now, null, NoticePriority.Urgent, MaxUrgent, ct);
        return notices.Select(n => n.ToSummaryDto(language, now)).ToList();
    }

    // Expired notices, most recently ended first
    public async Task<PagedResult<NoticeSummaryDto>> GetArchiveAsync(string lang, string? category, int page, int pageSize, CancellationToken ct)
    {
        var language = ParseLanguage(lang);
        var now = Clock.UtcNow;
        var (safePage, safeSize) = SafePaging(page, pageSize);

        var (items, total) = await repository.GetArchivePageAsync(now, ParseCategoryFilter(category), safePage, safeSize, ct);
        return new PagedResult<NoticeSummaryDto>(
            items.Select(n => n.ToSummaryDto(language, now)).ToList(), safePage, safeSize, total);
    }

    public async Task<NoticeDto?> GetPublishedByIdAsync(Guid id, string lang, CancellationToken ct)
    {
        var language = ParseLanguage(lang);
        var notice = await repository.GetPublishedByIdAsync(id, ct);
        return notice?.ToDto(language, Clock.UtcNow);
    }

    // ---------- Admin: reading ----------
    public async Task<PagedResult<AdminNoticeDto>> GetPageForAdminAsync(int page, int pageSize, CancellationToken ct)
    {
        var (safePage, safeSize) = SafePaging(page, pageSize);
        var (items, total) = await repository.GetPageAsync(safePage, safeSize, ct);
        return new PagedResult<AdminNoticeDto>(items.Select(n => n.ToAdminDto()).ToList(), safePage, safeSize, total);
    }

    public async Task<AdminNoticeDto?> GetForAdminAsync(Guid id, CancellationToken ct)
    {
        var notice = await repository.GetByIdAsync(id, ct);
        return notice?.ToAdminDto();
    }

    // ---------- Admin: changes (each one audited) ----------
    public async Task<AdminNoticeDto> CreateAsync(CreateNoticeRequest request, CancellationToken ct)
    {
        var translations = RequireTranslations(request.Translations);

        var notice = Notice.Create(
            translations.Select(t => (ParseLanguage(t.Language), ToText(t))).ToList(),
            request.Category, ParsePriority(request.Priority),
            ToUtcOrNull(request.ValidFrom), ToUtcOrNull(request.ValidUntil));

        repository.Add(notice);
        await repository.SaveChangesAsync(ct);
        await Log(AuditActions.NoticeCreated, notice, ct);

        return notice.ToAdminDto();
    }

    public Task<AdminNoticeDto?> UpdateAsync(Guid id, UpdateNoticeRequest request, CancellationToken ct)
    {
        if (request.Version is not { } version)
            throw new DomainException("The notice version is required. Reload the page and try again.");

        var translations = RequireTranslations(request.Translations);
        var priority = ParsePriority(request.Priority);
        var validFrom = ToUtcOrNull(request.ValidFrom);
        var validUntil = ToUtcOrNull(request.ValidUntil);

        return ChangeAsync(id, notice =>
        {
            notice.UpdateDetails(request.Category, priority, validFrom, validUntil);

            foreach (var t in translations)
                notice.SetTranslation(ParseLanguage(t.Language), ToText(t));

            // Remove the languages that were not sent
            var sent = translations.Select(t => ParseLanguage(t.Language)).ToHashSet();
            foreach (var t in notice.Translations.Where(t => !sent.Contains(t.Language)).ToList())
                notice.RemoveTranslation(t.Language);
        }, AuditActions.NoticeUpdated, ct, expectedVersion: version);
    }

    public Task<AdminNoticeDto?> PublishAsync(Guid id, CancellationToken ct) =>
        ChangeAsync(id, n => n.Publish(), AuditActions.NoticePublished, ct);

    public Task<AdminNoticeDto?> UnpublishAsync(Guid id, CancellationToken ct) =>
        ChangeAsync(id, n => n.Unpublish(), AuditActions.NoticeUnpublished, ct);

    // Returns false if the notice doesn't exist
    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var notice = await repository.GetByIdAsync(id, ct);
        if (notice is null)
            return false;

        notice.EnsureCanBeDeleted();
        var details = Describe(notice); // remember it before it's gone

        repository.Remove(notice);
        await repository.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEvent(AuditActions.NoticeDeleted, EntityType, id.ToString(), Details: details), ct);
        return true;
    }

    // ---------- Helpers ----------
    private async Task<AdminNoticeDto?> ChangeAsync(Guid id, Action<Notice> change, string auditAction,
        CancellationToken ct, uint? expectedVersion = null)
    {
        var notice = await repository.GetByIdAsync(id, ct);
        if (notice is null)
            return null;

        if (expectedVersion is { } version)
            repository.SetExpectedVersion(notice, version);

        change(notice);
        await repository.SaveChangesAsync(ct);
        await Log(auditAction, notice, ct);

        return notice.ToAdminDto();
    }

    private Task Log(string action, Notice notice, CancellationToken ct) =>
        audit.LogAsync(new AuditEvent(action, EntityType, notice.Id.ToString(), Details: Describe(notice)), ct);

    // What the audit log shows: the (Arabic) title, category and priority, readable even after a delete
    private static object Describe(Notice notice) => new
    {
        title = (notice.Translations.FirstOrDefault(t => t.Language == Language.Ar)
                 ?? notice.Translations.First()).Title,
        category = notice.Category,
        priority = notice.Priority.ToString().ToLowerInvariant()
    };

    private static List<NoticeTranslationDto> RequireTranslations(List<NoticeTranslationDto>? translations)
    {
        if (translations is null || translations.Count == 0)
            throw new DomainException("At least one translation is required.");
        if (translations.Any(t => t is null))
            throw new DomainException("Translations cannot contain empty entries.");
        return translations;
    }

    private static NoticeText ToText(NoticeTranslationDto t) => new(t.Title, t.Body, t.Area);

    // No priority sent means "normal"
    private static NoticePriority ParsePriority(string? priority) =>
        string.IsNullOrWhiteSpace(priority) ? NoticePriority.Normal : EnumParsing.ParseName<NoticePriority>(priority, "priority");

    // A filter: empty means "all categories"; anything else must be a known category
    private static string? ParseCategoryFilter(string? category)
    {
        var clean = category?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(clean))
            return null;
        if (!Notice.Categories.Contains(clean))
            throw new DomainException($"Unknown category: '{category}'. Allowed: {string.Join(", ", Notice.Categories)}.");
        return clean;
    }

    private static DateTime? ToUtcOrNull(DateTimeOffset? value) => value is { } v ? ToUtc(v) : null;

    // Any time zone in, UTC out, whole seconds
    private static DateTime ToUtc(DateTimeOffset value)
    {
        var utc = value.UtcDateTime;
        return new DateTime(utc.Ticks - utc.Ticks % TimeSpan.TicksPerSecond, DateTimeKind.Utc);
    }

    private static (int Page, int PageSize) SafePaging(int page, int pageSize) =>
        (Math.Max(page, 1), Math.Clamp(pageSize, 1, MaxPageSize));

    private static Language ParseLanguage(string? code) => EnumParsing.ParseName<Language>(code, "language");
}