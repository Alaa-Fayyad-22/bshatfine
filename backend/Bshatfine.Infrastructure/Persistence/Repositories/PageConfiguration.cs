using Bshatfine.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bshatfine.Infrastructure.Persistence.Configurations;

public class PageConfiguration : IEntityTypeConfiguration<Page>
{
    public void Configure(EntityTypeBuilder<Page> builder)
    {
        builder.ToTable("Pages");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();

        builder.Property(p => p.Key).HasMaxLength(50).IsRequired();
        builder.HasIndex(p => p.Key).IsUnique(); // one page per key, guaranteed by the database

        builder.Property(p => p.CoverImagePath).HasMaxLength(300);
        builder.Property(p => p.Version).IsRowVersion(); // PostgreSQL xmin

        builder.HasMany(p => p.Translations)
            .WithOne()
            .HasForeignKey(t => t.PageId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(p => p.Translations).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}