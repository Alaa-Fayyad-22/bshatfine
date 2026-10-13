using Bshatfine.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bshatfine.Infrastructure.Persistence.Configurations;

public class NewsConfiguration : IEntityTypeConfiguration<News>
{
    public void Configure(EntityTypeBuilder<News> builder)
    {
        // TODO 1: Id → we generate it ourselves
        // TODO 2: Status → stored as text, max 20
        // TODO 3: composite index on Status + PublishedAt
        // TODO 4: the relationship to Translations

        builder.Property(n => n.Id).ValueGeneratedNever();
        builder.Property(n => n.Status).HasConversion<string>().HasMaxLength(20);
        builder.HasIndex(n => new { n.Status, n.PublishedAt });
        builder.HasMany(n => n.Translations).WithOne().HasForeignKey(t => t.NewsId).OnDelete(DeleteBehavior.Cascade);
        builder.Property(n => n.Slug).HasMaxLength(70).IsRequired();
        builder.HasIndex(n => n.Slug).IsUnique();


    }
}