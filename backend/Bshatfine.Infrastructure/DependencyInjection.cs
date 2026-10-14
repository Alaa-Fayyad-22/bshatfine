using Bshatfine.Application.Abstractions;
using Bshatfine.Infrastructure.Identity;
using Bshatfine.Infrastructure.Images;
using Bshatfine.Infrastructure.Persistence;
using Bshatfine.Infrastructure.Persistence.Repositories;
using Bshatfine.Infrastructure.Storage;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Bshatfine.Infrastructure;

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
            })
            .AddRoles<IdentityRole<Guid>>()
            .AddEntityFrameworkStores<AppDbContext>();

        // ---------- Repositories and services ----------
        services.AddScoped<INewsRepository, NewsRepository>();
        services.AddScoped<IFileStorage, DatabaseFileStorage>();
        services.AddSingleton<IImageOptimizer, SkiaImageOptimizer>();

        return services;
    }
}