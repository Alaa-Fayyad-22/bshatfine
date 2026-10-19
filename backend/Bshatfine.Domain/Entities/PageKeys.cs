namespace Bshatfine.Domain.Entities;

// The only pages that can exist. Each one has a menu link and a route on the website.
public static class PageKeys
{
    public const string History = "history";
    public const string Tourism = "tourism";
    public const string Achievements = "achievements";
    public const string Services = "services";

    public static readonly IReadOnlySet<string> All =
        new HashSet<string> { History, Tourism, Achievements, Services };
}