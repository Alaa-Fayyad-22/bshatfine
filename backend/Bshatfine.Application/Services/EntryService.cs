using Bshatfine.Application.Abstractions;
using Bshatfine.Application.Dtos;
using Bshatfine.Application.Images;
using Bshatfine.Application.Security;
using Bshatfine.Application.Common;
using Bshatfine.Domain.Entries;
using Bshatfine.Domain.Enums;
using Bshatfine.Domain.Exceptions;

namespace Bshatfine.Application.Services;

public class EntryService(IEntryRepository repository, IFileStorage storage,
    CoverImageService coverImages, IAuditLogger audit)
{
    private const string EntityType = "Entry";
    private const string CoverFolder = "entries";

    // ---------- Public ----------
    public async Task<List<EntrySummaryDto>> GetPublishedAsync(string kind, string lang, CancellationToken ct)
    {
        var entryKind = ParseKind(kind);
        var language = ParseLanguage(lang);
        var entries = await repository.GetPublishedAsync(entryKind, ct);
        return entries.Select(e => e.ToSummaryDto(language, storage)).ToList();
    }

    public async Task<EntryDto?> GetPublishedByIdAsync(Guid id, string lang, CancellationToken ct)
    {
        var language = ParseLanguage(lang);
        var entry = await repository.GetPublishedByIdAsync(id, ct);
        return entry?.ToDto(language, storage);
    }

    // ---------- Admin: reading ----------
    public async Task<List<AdminEntryDto>> GetAllForAdminAsync(string kind, CancellationToken ct)
    {
        var entries = await repository.GetAllAsync(ParseKind(kind), ct);
        return entries.Select(e => e.ToAdminDto(storage)).ToList();
    }

    public async Task<AdminEntryDto?> GetForAdminAsync(Guid id, CancellationToken ct)
    {
        var entry = await repository.GetByIdAsync(id, ct);
        return entry?.ToAdminDto(storage);
    }

    // ---------- Admin: changes (each one audited) ----------
    public async Task<AdminEntryDto> CreateAsync(CreateEntryRequest request, CancellationToken ct)
    {
        var kind = ParseKind(request.Kind);
        var translations = RequireTranslations(request.Translations);

        // New entries go to the end of their kind's list
        var displayOrder = await repository.GetNextDisplayOrderAsync(kind, ct);

        var entry = Entry.Create(
            kind,
            translations.Select(t => (ParseLanguage(t.Language), t.Title, t.Summary, t.Body)).ToList(),
            request.Category, ParseStatus(request.Status), request.Year, displayOrder);

        repository.Add(entry);
        await repository.SaveChangesAsync(ct);
        await Log(AuditActions.EntryCreated, entry, ct);

        return entry.ToAdminDto(storage);
    }

    public Task<AdminEntryDto?> UpdateAsync(Guid id, UpdateEntryRequest request, CancellationToken ct)
    {
        if (request.Version is not { } version)
            throw new DomainException("The entry version is required. Reload the page and try again.");

        var translations = RequireTranslations(request.Translations);
        var status = ParseStatus(request.Status);

        return ChangeAsync(id, entry =>
        {
            entry.UpdateDetails(request.Category, status, request.Year);

            foreach (var t in translations)
                entry.SetTranslation(ParseLanguage(t.Language), t.Title, t.Summary, t.Body);

            // Remove the languages that were not sent
            var sent = translations.Select(t => ParseLanguage(t.Language)).ToHashSet();
            foreach (var t in entry.Translations.Where(t => !sent.Contains(t.Language)).ToList())
                entry.RemoveTranslation(t.Language);
        }, AuditActions.EntryUpdated, ct, expectedVersion: version);
    }

    public Task<AdminEntryDto?> PublishAsync(Guid id, CancellationToken ct) =>
        ChangeAsync(id, e => e.Publish(), AuditActions.EntryPublished, ct);

    public Task<AdminEntryDto?> UnpublishAsync(Guid id, CancellationToken ct) =>
        ChangeAsync(id, e => e.Unpublish(), AuditActions.EntryUnpublished, ct);

    public async Task<List<AdminEntryDto>> ReorderAsync(string kind, ReorderEntriesRequest request, CancellationToken ct)
    {
        var entryKind = ParseKind(kind);
        var entries = await repository.GetAllTrackedAsync(entryKind, ct);
        var ids = request.Ids ?? [];

        // The new order must list every entry of this kind exactly once
        if (ids.Count != entries.Count
            || ids.Distinct().Count() != ids.Count
            || !ids.All(id => entries.Any(e => e.Id == id)))
            throw new DomainException("The new order must list every entry of this kind exactly once.");

        for (var position = 0; position < ids.Count; position++)
            entries.Single(e => e.Id == ids[position]).SetDisplayOrder(position);

        await repository.SaveChangesAsync(ct);
        await audit.LogAsync(new AuditEvent(AuditActions.EntriesReordered, EntityType, Code(entryKind)), ct);

        // Reload with translations, so the response has the same shape as the list
        return await GetAllForAdminAsync(kind, ct);
    }

    public async Task<AdminEntryDto?> SetCoverImageAsync(Guid id, Stream content, long length, CancellationToken ct)
    {
        var entry = await repository.GetByIdAsync(id, ct);
        if (entry is null)
            return null;

        var newKey = await coverImages.SaveAsync(content, length, CoverFolder, ct);
        var oldKey = entry.CoverImagePath;

        try
        {
            entry.SetCoverImage(newKey);
            await repository.SaveChangesAsync(ct);
        }
        catch
        {
            await storage.DeleteAsync(newKey, ct); // don't leave an orphan file behind
            throw;
        }

        if (oldKey is not null)
            await storage.DeleteAsync(oldKey, ct);

        await Log(AuditActions.EntryCoverSet, entry, ct);
        return entry.ToAdminDto(storage);
    }

    public async Task<AdminEntryDto?> RemoveCoverImageAsync(Guid id, CancellationToken ct)
    {
        var entry = await repository.GetByIdAsync(id, ct);
        if (entry is null)
            return null;

        var oldKey = entry.CoverImagePath;
        entry.RemoveCoverImage();
        await repository.SaveChangesAsync(ct);

        if (oldKey is not null)
            await storage.DeleteAsync(oldKey, ct);

        await Log(AuditActions.EntryCoverRemoved, entry, ct);
        return entry.ToAdminDto(storage);
    }

    // Returns false if the entry doesn't exist
    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var entry = await repository.GetByIdAsync(id, ct);
        if (entry is null)
            return false;

        entry.EnsureCanBeDeleted();

        // Remember what we need before the entry is gone
        var coverKey = entry.CoverImagePath;
        var details = Describe(entry);

        repository.Remove(entry);
        await repository.SaveChangesAsync(ct);

        // Delete the photo only after the entry is gone from the database
        if (coverKey is not null)
            await storage.DeleteAsync(coverKey, ct);

        await audit.LogAsync(new AuditEvent(AuditActions.EntryDeleted, EntityType, id.ToString(), Details: details), ct);
        return true;
    }

    // ---------- Helpers ----------
    private async Task<AdminEntryDto?> ChangeAsync(Guid id, Action<Entry> change, string auditAction,
        CancellationToken ct, uint? expectedVersion = null)
    {
        var entry = await repository.GetByIdAsync(id, ct);
        if (entry is null)
            return null;

        if (expectedVersion is { } version)
            repository.SetExpectedVersion(entry, version);

        change(entry);
        await repository.SaveChangesAsync(ct);
        await Log(auditAction, entry, ct);

        return entry.ToAdminDto(storage);
    }

    private Task Log(string action, Entry entry, CancellationToken ct) =>
        audit.LogAsync(new AuditEvent(action, EntityType, entry.Id.ToString(), Details: Describe(entry)), ct);

    // What the audit log shows: the kind and the (Arabic) title, readable even after a delete
    private static object Describe(Entry entry) => new
    {
        kind = Code(entry.Kind),
        title = (entry.Translations.FirstOrDefault(t => t.Language == Language.Ar)
                 ?? entry.Translations.First()).Title
    };

    private static List<EntryTranslationDto> RequireTranslations(List<EntryTranslationDto>? translations)
    {
        if (translations is null || translations.Count == 0)
            throw new DomainException("At least one translation is required.");
        if (translations.Any(t => t is null))
            throw new DomainException("Translations cannot contain empty entries.");
        return translations;
    }

    private static EntryKind ParseKind(string? kind) => EnumParsing.ParseName<EntryKind>(kind, "kind");

    private static Language ParseLanguage(string? code) => EnumParsing.ParseName<Language>(code, "language");

    // No status sent means "no status" (only projects need one; the Domain checks that)
    private static ProjectStatus? ParseStatus(string? status) =>
        string.IsNullOrWhiteSpace(status) ? null : EnumParsing.ParseName<ProjectStatus>(status, "status");

    private static string Code(Enum value) => value.ToString().ToLowerInvariant();
}