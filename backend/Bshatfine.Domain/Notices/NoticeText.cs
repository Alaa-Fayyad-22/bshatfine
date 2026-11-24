namespace Bshatfine.Domain.Notices;

/// <summary>The texts of a notice in one language.</summary>
public sealed record NoticeText(string Title, string? Body, string? Area);