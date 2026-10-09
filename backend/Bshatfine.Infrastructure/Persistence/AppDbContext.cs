using Bshatfine.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Bshatfine.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<News> News => Set<News>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<News>(entity =>
        {
            entity.Property(n => n.Title).HasMaxLength(Bshatfine.Domain.Entities.News.TitleMaxLength).IsRequired();
            entity.Property(n => n.Body).IsRequired();

            entity.Property(n => n.Status)
                .HasConversion<string>()
                .HasMaxLength(20);

            entity.HasIndex(n => new { n.Status, n.PublishedAt });
        });
    }
}