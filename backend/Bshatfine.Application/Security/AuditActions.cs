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

    // Users
    public const string UserCreated = "user.created";
    public const string UserUpdated = "user.updated";
    public const string UserRoleChanged = "user.role_changed";
    public const string UserDisabled = "user.disabled";
    public const string UserEnabled = "user.enabled";
    public const string UserPasswordReset = "user.password_reset";
    public const string UserForcedLogout = "user.forced_logout";
    public const string UserUnlocked = "user.unlocked";
    public const string PasswordChanged = "auth.password.changed";
    public const string Registered = "auth.registered";
    public const string RegistrationDuplicate = "auth.register.duplicate_email";
}