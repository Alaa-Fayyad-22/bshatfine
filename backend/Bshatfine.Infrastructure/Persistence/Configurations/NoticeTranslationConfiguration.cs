using Bshatfine.Domain.Notices;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bshatfine.Infrastructure.Persistence.Configurations;

public class NoticeTranslationConfiguration : IEntityTypeConfiguration<NoticeTranslation>
{
    public void Configure(EntityTypeBuilder<NoticeTranslation> builder)
    {
        builder.ToTable("NoticeTranslations");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).ValueGeneratedNever();

        builder.Property(t => t.Language).HasConversion<string>().HasMaxLength(5);
        builder.Property(t => t.Title).HasMaxLength(NoticeTranslation.TitleMaxLength).IsRequired();
        builder.Property(t => t.Body).HasMaxLength(NoticeTranslation.BodyMaxLength).IsRequired(); // may be empty
        builder.Property(t => t.Area).HasMaxLength(NoticeTranslation.AreaMaxLength).IsRequired(); // may be empty

        builder.HasIndex(t => new { t.NoticeId, t.Language }).IsUnique(); // one translation per language
    }
}