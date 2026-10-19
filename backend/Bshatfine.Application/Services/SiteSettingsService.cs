using Bshatfine.Application.Abstractions;
using Bshatfine.Application.Common;
using Bshatfine.Application.Dtos;
using Bshatfine.Application.Security;
using Bshatfine.Domain.Entities;
using Bshatfine.Domain.Enums;
using Bshatfine.Domain.Exceptions;

namespace Bshatfine.Application.Services;

public class SiteSettingsService(ISiteSettingsRepository repository, IAuditLogger audit)
{
    // Public: never 404. Before anything is saved, every field is simply null.
    public async Task<SiteSettingsDto> GetPublicAsync(string lang, CancellationToken ct)
    {
        var language = EnumParsing.ParseName<Language>(lang, "language");
        var s = await repository.GetReadOnlyAsync(ct) ?? SiteSettings.CreateEmpty();

        return new SiteSettingsDto(
            s.Phone,
            s.SecondaryPhone,
            s.Email,
            Localized(language, s.AddressAr, s.AddressEn),
            Localized(language, s.OpeningHoursAr, s.OpeningHoursEn),
            s.MapUrl,
            s.FacebookUrl,
            s.InstagramUrl);
    }

    public async Task<AdminSiteSettingsDto> GetForAdminAsync(CancellationToken ct)
    {
        var existing = await repository.GetReadOnlyAsync(ct);
        return ToAdminDto(existing ?? SiteSettings.CreateEmpty(), exists: existing is not null);
    }

    public async Task<AdminSiteSettingsDto> UpdateAsync(UpdateSiteSettingsRequest request, CancellationToken ct)
    {
        var settings = await repository.GetAsync(ct);

        if (settings is null)
        {
            // The very first save creates the row
            settings = SiteSettings.CreateEmpty();
            repository.Add(settings);
        }
        else
        {
            if (request.Version is not { } version)
                throw new DomainException("The version is required. Reload the page and try again.");
            repository.SetExpectedVersion(settings, version);
        }

        settings.Update(new SiteSettingsValues(
            request.Phone, request.SecondaryPhone, request.Email,
            request.AddressAr, request.AddressEn,
            request.OpeningHoursAr, request.OpeningHoursEn,
            request.MapUrl, request.FacebookUrl, request.InstagramUrl));

        await repository.SaveChangesAsync(ct);
        await audit.LogAsync(new AuditEvent(AuditActions.SiteSettingsUpdated, "SiteSettings", "contact"), ct);

        return ToAdminDto(settings, exists: true);
    }

    // The requested language, or the other one if only that one is filled in
    private static string? Localized(Language language, string? arabic, string? english) =>
        language == Language.Ar ? arabic ?? english : english ?? arabic;

    private static AdminSiteSettingsDto ToAdminDto(SiteSettings s, bool exists) =>
        new(s.Phone, s.SecondaryPhone, s.Email,
            s.AddressAr, s.AddressEn, s.OpeningHoursAr, s.OpeningHoursEn,
            s.MapUrl, s.FacebookUrl, s.InstagramUrl,
            s.UpdatedAt, exists ? s.Version : null);
}