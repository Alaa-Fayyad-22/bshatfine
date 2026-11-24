using Bshatfine.Domain.Notices;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bshatfine.Infrastructure.Persistence.Configurations;

public class NoticeConfiguration : IEntityTypeConfiguration<Notice>
{
    public void Configure(EntityTypeBuilder<Notice> builder)
    {
        builder.ToTable("Notices");
        builder.HasKey(n => n.Id);
        builder.Property(n => n.Id).ValueGeneratedNever();

        builder.Property(n => n.Category).HasMaxLength(50).IsRequired();

        // Enum stored as readable text ("Urgent"), safe if the enum order ever changes
        builder.Property(n => n.Priority).HasConversion<string>().HasMaxLength(20).IsRequired();

        builder.Property(n => n.Version).IsRowVersion(); // PostgreSQL xmin

        builder.HasMany(n => n.Translations)
            .WithOne()
            .HasForeignKey(t => t.NoticeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(n => n.Translations).UsePropertyAccessMode(PropertyAccessMode.Field);

        // Public lists: active (ValidUntil empty or still ahead) and archive (ValidUntil passed)
        builder.HasIndex(n => new { n.IsPublished, n.ValidUntil });

        // Admin list: newest first
        builder.HasIndex(n => n.CreatedAt);
    }
}