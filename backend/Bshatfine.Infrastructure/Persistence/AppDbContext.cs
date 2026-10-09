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
            entity.Property(n => n.Title).HasMaxLength(200).IsRequired();
            entity.HasIndex(n => n.PublishedAt);
        });
    }
}