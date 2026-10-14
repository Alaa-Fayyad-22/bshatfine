using Bshatfine.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Bshatfine.Infrastructure.Storage;
namespace Bshatfine.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<News> News => Set<News>();
    public DbSet<StoredFile> StoredFiles => Set<StoredFile>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}