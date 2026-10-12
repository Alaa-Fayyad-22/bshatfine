using Bshatfine.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bshatfine.Infrastructure.Persistence.Configurations;

public class NewsTranslationConfiguration : IEntityTypeConfiguration<NewsTranslations>
{
    public void Configure(EntityTypeBuilder<NewsTranslations> builder)
    {
        builder.ToTable("NewsTranslations");
        builder.Property(t => t.Id).ValueGeneratedNever();
        builder.Property(t => t.Title).HasMaxLength(NewsTranslations.TitleMaxLength).IsRequired();
        builder.Property(t => t.Body).IsRequired();
        builder.Property(t => t.Language).HasConversion<string>().HasMaxLength(5);
        builder.HasIndex(t => new { t.NewsId, t.Language }).IsUnique();

    }
}