using Bshatfine.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bshatfine.Infrastructure.Persistence.Configurations;

public class PageTranslationConfiguration : IEntityTypeConfiguration<PageTranslation>
{
    public void Configure(EntityTypeBuilder<PageTranslation> builder)
    {
        builder.ToTable("PageTranslations");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).ValueGeneratedNever();

        builder.Property(t => t.Language).HasConversion<string>().HasMaxLength(5);
        builder.Property(t => t.Title).HasMaxLength(PageTranslation.TitleMaxLength).IsRequired();
        builder.Property(t => t.Body).IsRequired();

        builder.HasIndex(t => new { t.PageId, t.Language }).IsUnique(); // one translation per language
    }
}