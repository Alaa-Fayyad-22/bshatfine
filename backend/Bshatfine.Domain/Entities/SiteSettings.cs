using System.Net.Mail;
using System.Text.RegularExpressions;
using Bshatfine.Domain.Common;
using Bshatfine.Domain.Exceptions;

namespace Bshatfine.Domain.Entities;

// The municipality's official contact details. Exactly one row exists.
public partial class SiteSettings
{
    public const int SingletonId = 1;
    public const int PhoneMaxLength = 30;
    public const int EmailMaxLength = 256;
    public const int TextMaxLength = 300;
    public const int UrlMaxLength = 500;

    // Characters that never belong in a link a person types or pastes,
    // and that could break out of an HTML attribute
    private static readonly char[] ForbiddenUrlChars = ['"', '\'', '<', '>', '\\', '`', ' ', '\t', '\r', '\n'];

    public int Id { get; private set; }
    public string? Phone { get; private set; }
    public string? SecondaryPhone { get; private set; }
    public string? Email { get; private set; }
    public string? AddressAr { get; private set; }
    public string? AddressEn { get; private set; }
    public string? OpeningHoursAr { get; private set; }
    public string? OpeningHoursEn { get; private set; }
    public string? MapUrl { get; private set; }
    public string? FacebookUrl { get; private set; }
    public string? InstagramUrl { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public uint Version { get; private set; } // concurrency (PostgreSQL xmin)

    private SiteSettings() { } // for EF Core

    public static SiteSettings CreateEmpty() => new() { Id = SingletonId };

    public void Update(SiteSettingsValues values)
    {
        Phone = OptionalPhone(values.Phone, "phone number");
        SecondaryPhone = OptionalPhone(values.SecondaryPhone, "second phone number");
        Email = OptionalEmail(values.Email);
        AddressAr = OptionalText(values.AddressAr, "Arabic address");
        AddressEn = OptionalText(values.AddressEn, "English address");
        OpeningHoursAr = OptionalText(values.OpeningHoursAr, "Arabic opening hours");
        OpeningHoursEn = OptionalText(values.OpeningHoursEn, "English opening hours");
        MapUrl = OptionalHttpsUrl(values.MapUrl, "map link");
        FacebookUrl = OptionalHttpsUrl(values.FacebookUrl, "Facebook link");
        InstagramUrl = OptionalHttpsUrl(values.InstagramUrl, "Instagram link");
        UpdatedAt = Clock.UtcNow;
    }

    // ---------- Validation (every field is optional: empty means "not provided") ----------

    [GeneratedRegex(@"^\+?[0-9][0-9 \-()]{4,28}$")]
    private static partial Regex PhonePattern();

    // An everyday address only: name@domain.tld
    // (no quoted names, no spaces, no IP addresses, at least one dot in the domain)
    [GeneratedRegex(@"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9](?:[A-Za-z0-9\-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9\-]*[A-Za-z0-9])?)+$")]
    private static partial Regex EmailPattern();

    private static string? OptionalText(string? value, string label)
    {
        var clean = value?.Trim();
        if (string.IsNullOrEmpty(clean))
            return null;
        if (clean.Length > TextMaxLength)
            throw new DomainException($"The {label} cannot exceed {TextMaxLength} characters.");
        return clean;
    }

    private static string? OptionalPhone(string? value, string label)
    {
        var clean = value?.Trim();
        if (string.IsNullOrEmpty(clean))
            return null;
        if (clean.Length > PhoneMaxLength || !PhonePattern().IsMatch(clean))
            throw new DomainException($"The {label} may only contain digits, spaces, +, - and parentheses.");
        return clean;
    }

    private static string? OptionalEmail(string? value)
    {
        var clean = value?.Trim();
        if (string.IsNullOrEmpty(clean))
            return null;
        if (clean.Length > EmailMaxLength
            || !EmailPattern().IsMatch(clean)
            || !MailAddress.TryCreate(clean, out var parsed)
            || parsed.Address != clean)
            throw new DomainException("The email address is not valid.");
        return clean;
    }

    private static string? OptionalHttpsUrl(string? value, string label)
    {
        var clean = value?.Trim();
        if (string.IsNullOrEmpty(clean))
            return null;
        if (clean.Length > UrlMaxLength
            || clean.IndexOfAny(ForbiddenUrlChars) >= 0              // no quotes, spaces, < > \ `
            || !Uri.TryCreate(clean, UriKind.Absolute, out var uri)
            || uri.Scheme != Uri.UriSchemeHttps
            || !string.IsNullOrEmpty(uri.UserInfo)                   // no https://user:password@...
            || uri.HostNameType != UriHostNameType.Dns               // a real host name, not an IP
            || !uri.Host.Contains('.'))                              // e.g. maps.google.com, not localhost
            throw new DomainException($"The {label} must be a complete https:// address.");

        // AbsoluteUri keeps special characters escaped (%22), so nothing unsafe is ever stored
        return uri.AbsoluteUri;
    }
}

public record SiteSettingsValues(
    string? Phone,
    string? SecondaryPhone,
    string? Email,
    string? AddressAr,
    string? AddressEn,
    string? OpeningHoursAr,
    string? OpeningHoursEn,
    string? MapUrl,
    string? FacebookUrl,
    string? InstagramUrl);