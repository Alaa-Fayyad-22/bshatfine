using Bshatfine.Domain.Entities;
using Bshatfine.Infrastructure.Audit;
using Bshatfine.Infrastructure.Identity;
using Bshatfine.Infrastructure.Storage;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Bshatfine.Domain.Entries;

namespace Bshatfine.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<AppUser, IdentityRole<Guid>, Guid>(options), IDataProtectionKeyContext
{
    public DbSet<News> News => Set<News>();
    public DbSet<StoredFile> StoredFiles => Set<StoredFile>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();
    public DbSet<Page> Pages => Set<Page>();
    public DbSet<SiteSettings> SiteSettings => Set<SiteSettings>();
    public DbSet<CouncilMember> CouncilMembers => Set<CouncilMember>();
    public DbSet<Entry> Entries => Set<Entry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Identity configures its own tables first
        base.OnModelCreating(modelBuilder);

        // Then every IEntityTypeConfiguration class in this project
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}