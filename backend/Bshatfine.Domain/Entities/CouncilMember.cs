using Bshatfine.Domain.Common;
using Bshatfine.Domain.Exceptions;

namespace Bshatfine.Domain.Entities;

public class CouncilMember
{
    public const int TextMaxLength = 150;

    public Guid Id { get; private set; }
    public string NameAr { get; private set; } = string.Empty;
    public string? NameEn { get; private set; }
    public string PositionAr { get; private set; } = string.Empty;
    public string? PositionEn { get; private set; }
    public string? PhotoPath { get; private set; }
    public int DisplayOrder { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public uint Version { get; private set; } // concurrency (PostgreSQL xmin)

    private CouncilMember() { } // for EF Core

    public static CouncilMember Create(string nameAr, string? nameEn, string positionAr, string? positionEn, int displayOrder)
    {
        var member = new CouncilMember
        {
            Id = Guid.CreateVersion7(),
            IsActive = true,
            CreatedAt = Clock.UtcNow
        };
        member.SetDetails(nameAr, nameEn, positionAr, positionEn);
        member.DisplayOrder = RequireOrder(displayOrder);
        return member;
    }

    public void UpdateDetails(string nameAr, string? nameEn, string positionAr, string? positionEn)
    {
        SetDetails(nameAr, nameEn, positionAr, positionEn);
        Touch();
    }

    public void SetDisplayOrder(int displayOrder)
    {
        DisplayOrder = RequireOrder(displayOrder);
        Touch();
    }

    public void Activate()
    {
        if (IsActive)
            throw new DomainException("This member is already active.");
        IsActive = true;
        Touch();
    }

    public void Deactivate()
    {
        if (!IsActive)
            throw new DomainException("This member is already inactive.");
        IsActive = false;
        Touch();
    }

    public void SetPhoto(string storageKey)
    {
        PhotoPath = storageKey;
        Touch();
    }

    public void RemovePhoto()
    {
        if (PhotoPath is null)
            throw new DomainException("This member has no photo.");
        PhotoPath = null;
        Touch();
    }

    private void SetDetails(string nameAr, string? nameEn, string positionAr, string? positionEn)
    {
        NameAr = Required(nameAr, "Arabic name");
        NameEn = Optional(nameEn, "English name");
        PositionAr = Required(positionAr, "Arabic position");
        PositionEn = Optional(positionEn, "English position");
    }

    private static string Required(string? value, string label) =>
        Optional(value, label) ?? throw new DomainException($"The {label} is required.");

    private static string? Optional(string? value, string label)
    {
        var clean = value?.Trim();
        if (string.IsNullOrEmpty(clean))
            return null;
        if (clean.Length > TextMaxLength)
            throw new DomainException($"The {label} cannot exceed {TextMaxLength} characters.");
        return clean;
    }

    private static int RequireOrder(int order) =>
        order is >= 0 and <= 1000 ? order : throw new DomainException("The display order must be between 0 and 1000.");

    private void Touch() => UpdatedAt = Clock.UtcNow;
}
