namespace Bshatfine.Application.Security;

public static class AuditActions
{
    // Authentication
    public const string LoginSucceeded = "auth.login.succeeded";
    public const string LoginFailed = "auth.login.failed";
    public const string LoginLockedOut = "auth.login.locked_out";
    public const string Logout = "auth.logout";

    // News
    public const string NewsCreated = "news.created";
    public const string NewsUpdated = "news.updated";
    public const string NewsPublished = "news.published";
    public const string NewsArchived = "news.archived";
    public const string NewsRepublished = "news.republished";
    public const string NewsCoverSet = "news.cover.set";
    public const string NewsCoverRemoved = "news.cover.removed";
}