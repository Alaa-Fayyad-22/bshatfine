using Bshatfine.Application.Services;
using Bshatfine.Application.Images;
using Microsoft.Extensions.DependencyInjection;

namespace Bshatfine.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<NewsService>();
        services.AddScoped<CoverImageService>();
        services.AddScoped<SiteSettingsService>();
        services.AddScoped<CouncilService>();
        services.AddScoped<EntryService>();
        services.AddScoped<EventService>();
        services.AddScoped<NoticeService>();
        return services;
    }
}