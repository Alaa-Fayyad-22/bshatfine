namespace Bshatfine.Domain.Common;

public static class Clock
{
    // PostgreSQL stores microseconds; .NET has 100-nanosecond ticks.
    // Truncating here means a value is identical before and after saving.
    public static DateTime UtcNow
    {
        get
        {
            var now = DateTime.UtcNow;
            return new DateTime(now.Ticks - now.Ticks % 10, DateTimeKind.Utc);
        }
    }
}