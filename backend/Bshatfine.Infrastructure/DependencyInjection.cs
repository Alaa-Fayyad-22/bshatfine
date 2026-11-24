using Bshatfine.Application.Abstractions;
using Bshatfine.Infrastructure.Identity;
using Bshatfine.Infrastructure.Images;
using Bshatfine.Infrastructure.Persistence;
using Bshatfine.Infrastructure.Persistence.Repositories;
using Bshatfine.Infrastructure.Storage;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Bshatfine.Infrastructure.Audit;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.DataProtection;
namespace Bshatfine.Infrastructure;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, string connectionString)
    {
        // ---------- Database ----------
        services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));

        // ---------- Identity (accounts, passwords, roles) ----------
        services
            .AddIdentityCore<AppUser>(options =>
            {
                // Passwords: length beats complexity (current NIST guidance)
                options.Password.RequiredLength = 12;
                options.Password.RequireNonAlphanumeric = false;
                options.Password.RequiredUniqueChars = 4;

                // Lockout: 5 wrong attempts → locked for 15 minutes, for every account
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
                options.Lockout.AllowedForNewUsers = true;

                // One account per email
                options.User.RequireUniqueEmail = true;
                // Accounts need a confirmed email to log in.
                // Staff are confirmed at creation; citizens will confirm by email in Phase 2.
                options.SignIn.RequireConfirmedEmail = true;
            })
            .AddRoles<IdentityRole<Guid>>()
            .AddEntityFrameworkStores<AppDbContext>()
            .AddRoles<IdentityRole<Guid>>()
            .AddClaimsPrincipalFactory<AppUserClaimsPrincipalFactory>()
            .AddEntityFrameworkStores<AppDbContext>()
            .AddSignInManager()
            .AddDefaultTokenProviders(); ;

        // ---------- Repositories and services ----------
        services.AddScoped<INewsRepository, NewsRepository>();
        services.AddScoped<ISiteSettingsRepository, SiteSettingsRepository>();
        services.AddScoped<ICouncilRepository, CouncilRepository>();
        services.AddScoped<IFileStorage, DatabaseFileStorage>();
        services.AddSingleton<IImageOptimizer, SkiaImageOptimizer>();
        services.AddHttpContextAccessor();
        services.AddScoped<IAuditLogger, AuditLogger>();
        services.AddScoped<IAuditLogQueries, AuditLogQueries>();
        services.AddScoped<IUserAdminService, UserAdminService>();
        services.AddScoped<IEntryRepository, EntryRepository>();
        services.AddScoped<IExclusiveLock, PostgresExclusiveLock>();
        services.AddScoped<IAuthSessionStore, AuthSessionStore>();
        services.AddScoped<IEventRepository, EventRepository>();
        services.AddScoped<INoticeRepository, NoticeRepository>();
        services.AddDataProtection()
            .SetApplicationName("Bshatfine")
            .PersistKeysToDbContext<AppDbContext>();

        return services;
    }
}