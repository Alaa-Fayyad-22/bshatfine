using Bshatfine.Domain.Exceptions;

namespace Bshatfine.Application.Common;

public static class EnumParsing
{
    // Matches only the enum NAMES, case-insensitively. Enum.TryParse alone would also accept numbers like "1".
    public static TEnum ParseName<TEnum>(string? value, string label) where TEnum : struct, Enum
    {
        var name = Enum.GetNames<TEnum>()
            .FirstOrDefault(n => string.Equals(n, value, StringComparison.OrdinalIgnoreCase));
        if (name is not null)
            return Enum.Parse<TEnum>(name);
        throw new DomainException($"Unsupported {label}: '{value}'.");
    }
}