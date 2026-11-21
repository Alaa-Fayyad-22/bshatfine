using Bshatfine.Domain.Entries;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bshatfine.Infrastructure.Persistence.Configurations;

public class EntryTranslationConfiguration : IEntityTypeConfiguration<EntryTranslation>
{
    public void Configure(EntityTypeBuilder<EntryTranslation> builder)
    {
        builder.ToTable("EntryTranslations");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).ValueGeneratedNever();

        builder.Property(t => t.Language).HasConversion<string>().HasMaxLength(5);
        builder.Property(t => t.Title).HasMaxLength(EntryTranslation.TitleMaxLength).IsRequired();
        builder.Property(t => t.Summary).HasMaxLength(EntryTranslation.SummaryMaxLength).IsRequired();
        builder.Property(t => t.Body).IsRequired(); // may be an empty string; the 50,000 limit is in the Domain

        builder.HasIndex(t => new { t.EntryId, t.Language }).IsUnique(); // one translation per language
    }
}
