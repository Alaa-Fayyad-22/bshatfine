using Bshatfine.Domain.Enums;

namespace Bshatfine.Domain.Entries;

// What each kind of entry allows. This is the ONLY place where kinds differ:
// adding a kind later means adding one line here.
public static class EntryKindRules
{
	private static readonly Dictionary<EntryKind, KindRule> Rules = new()
	{
		[EntryKind.History] = new(Categories: [], UsesStatus: false, UsesYear: true),
		[EntryKind.Project] = new(
			Categories: ["roads", "lighting", "water", "green-spaces", "environment", "buildings", "other"],
			UsesStatus: true, UsesYear: true),
		[EntryKind.Place] = new(Categories: ["heritage", "nature", "village-life"], UsesStatus: false, UsesYear: false),
		[EntryKind.Service] = new(Categories: ["certificate", "permit", "fees"], UsesStatus: false, UsesYear: false),
	};

	public static KindRule For(EntryKind kind) => Rules[kind];
}

public sealed record KindRule(IReadOnlyList<string> Categories, bool UsesStatus, bool UsesYear)
{
	public bool UsesCategory => Categories.Count > 0;
}