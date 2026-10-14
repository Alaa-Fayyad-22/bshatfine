namespace Bshatfine.Application.Security;

public static class Policies
{
    public const string Staff = "Staff";         // Admin or Editor
    public const string AdminOnly = "AdminOnly"; // user management, settings
}