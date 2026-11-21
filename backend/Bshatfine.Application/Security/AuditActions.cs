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
    public const string NewsDeleted = "news.deleted";

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

    // Pages
    public const string PageCreated = "page.created";
    public const string PageUpdated = "page.updated";
    public const string PagePublished = "page.published";
    public const string PageUnpublished = "page.unpublished";
    public const string PageCoverSet = "page.cover.set";
    public const string PageCoverRemoved = "page.cover.removed";

    // Site settings
    public const string SiteSettingsUpdated = "settings.updated";

    // Council
    public const string CouncilMemberCreated = "council.member.created";
    public const string CouncilMemberUpdated = "council.member.updated";
    public const string CouncilMemberActivated = "council.member.activated";
    public const string CouncilMemberDeactivated = "council.member.deactivated";
    public const string CouncilMemberDeleted = "council.member.deleted";
    public const string CouncilMemberPhotoSet = "council.member.photo.set";
    public const string CouncilMemberPhotoRemoved = "council.member.photo.removed";
    public const string CouncilReordered = "council.reordered";

    // Entries (history, projects, places, services)
    public const string EntryCreated = "entry.created";
    public const string EntryUpdated = "entry.updated";
    public const string EntryPublished = "entry.published";
    public const string EntryUnpublished = "entry.unpublished";
    public const string EntryCoverSet = "entry.cover.set";
    public const string EntryCoverRemoved = "entry.cover.removed";
    public const string EntryDeleted = "entry.deleted";
    public const string EntriesReordered = "entry.reordered";
}