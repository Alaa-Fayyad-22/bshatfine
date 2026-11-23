namespace Bshatfine.Domain.Events;

/// <summary>The texts of an event in one language.</summary>
public sealed record EventText(
    string Title,
    string Summary,
    string? Body,
    string? Location,
    string? Organizer);