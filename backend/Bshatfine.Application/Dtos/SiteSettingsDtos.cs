namespace Bshatfine.Application.Dtos;

// Public: one language
public record SiteSettingsDto(
    string? Phone,
    string? SecondaryPhone,
    string? Email,
    string? Address,
    string? OpeningHours,
    string? MapUrl,
    string? FacebookUrl,
    string? InstagramUrl);

// Admin: every field; Version is null until the first save
public record AdminSiteSettingsDto(
    string? Phone,
    string? SecondaryPhone,
    string? Email,
    string? AddressAr,
    string? AddressEn,
    string? OpeningHoursAr,
    string? OpeningHoursEn,
    string? MapUrl,
    string? FacebookUrl,
    string? InstagramUrl,
    DateTime? UpdatedAt,
    uint? Version);

public record UpdateSiteSettingsRequest(
    string? Phone,
    string? SecondaryPhone,
    string? Email,
    string? AddressAr,
    string? AddressEn,
    string? OpeningHoursAr,
    string? OpeningHoursEn,
    string? MapUrl,
    string? FacebookUrl,
    string? InstagramUrl,
    uint? Version);