using Bshatfine.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bshatfine.Infrastructure.Persistence.Configurations;

public class SiteSettingsConfiguration : IEntityTypeConfiguration<SiteSettings>
{
    public void Configure(EntityTypeBuilder<SiteSettings> builder)
    {
        builder.ToTable("SiteSettings");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever(); // always 1, never auto-numbered

        builder.Property(s => s.Phone).HasMaxLength(SiteSettings.PhoneMaxLength);
        builder.Property(s => s.SecondaryPhone).HasMaxLength(SiteSettings.PhoneMaxLength);
        builder.Property(s => s.Email).HasMaxLength(SiteSettings.EmailMaxLength);
        builder.Property(s => s.AddressAr).HasMaxLength(SiteSettings.TextMaxLength);
        builder.Property(s => s.AddressEn).HasMaxLength(SiteSettings.TextMaxLength);
        builder.Property(s => s.OpeningHoursAr).HasMaxLength(SiteSettings.TextMaxLength);
        builder.Property(s => s.OpeningHoursEn).HasMaxLength(SiteSettings.TextMaxLength);
        builder.Property(s => s.MapUrl).HasMaxLength(SiteSettings.UrlMaxLength);
        builder.Property(s => s.FacebookUrl).HasMaxLength(SiteSettings.UrlMaxLength);
        builder.Property(s => s.InstagramUrl).HasMaxLength(SiteSettings.UrlMaxLength);

        builder.Property(s => s.Version).IsRowVersion(); // PostgreSQL xmin
    }
}