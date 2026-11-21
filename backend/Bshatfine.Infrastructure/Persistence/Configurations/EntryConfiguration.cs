using Bshatfine.Domain.Entries;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bshatfine.Infrastructure.Persistence.Configurations;

public class EntryConfiguration : IEntityTypeConfiguration<Entry>
{
    public void Configure(EntityTypeBuilder<Entry> builder)
    {
        builder.ToTable("Entries");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();

        // Enums stored as readable text ("Project", "Completed"), safe if the enum order ever changes
        builder.Property(e => e.Kind).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);

        builder.Property(e => e.Category).HasMaxLength(50);
        builder.Property(e => e.CoverImagePath).HasMaxLength(300);
        builder.Property(e => e.Version).IsRowVersion(); // PostgreSQL xmin

        builder.HasMany(e => e.Translations)
            .WithOne()
            .HasForeignKey(t => t.EntryId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(e => e.Translations).UsePropertyAccessMode(PropertyAccessMode.Field);

        // Public lists: published entries of one kind, in order
        builder.HasIndex(e => new { e.Kind, e.IsPublished, e.DisplayOrder });
    }
}