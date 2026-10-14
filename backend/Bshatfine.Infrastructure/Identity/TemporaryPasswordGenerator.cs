using System.Security.Cryptography;

namespace Bshatfine.Infrastructure.Identity;

public static class TemporaryPasswordGenerator
{
    // No look-alike characters (0/O, 1/l/I), so it can be read out over the phone
    private const string Upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    private const string Lower = "abcdefghijkmnpqrstuvwxyz";
    private const string Digits = "23456789";
    private const string All = Upper + Lower + Digits;

    public static string Generate()
    {
        while (true)
        {
            var chars = RandomNumberGenerator.GetString(All, 16);

            if (chars.Any(char.IsUpper) && chars.Any(char.IsLower) && chars.Any(char.IsDigit))
                return $"{chars[..4]}-{chars[4..8]}-{chars[8..12]}-{chars[12..]}";
        }
    }
}