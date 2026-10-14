using Bshatfine.Application.Abstractions;
using Bshatfine.Infrastructure.Storage;
using Bshatfine.Infrastructure.Persistence;
using Bshatfine.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Bshatfine.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));
        services.AddScoped<INewsRepository, NewsRepository>();

        services.AddScoped<IFileStorage, DatabaseFileStorage>();
        return services;
    }
}