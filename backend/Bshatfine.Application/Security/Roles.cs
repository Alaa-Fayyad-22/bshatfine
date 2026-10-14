namespace Bshatfine.Application.Security;

public static class Roles
{
    public const string Admin = "Admin";
    public const string Editor = "Editor";
    public const string Citizen = "Citizen";

    public static readonly string[] All = [Admin, Editor, Citizen];
    public static readonly string[] Staff = [Admin, Editor];
}