using Bshatfine.Application.Services;
using Microsoft.Extensions.DependencyInjection;

namespace Bshatfine.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<NewsService>();
        return services;
    }
}