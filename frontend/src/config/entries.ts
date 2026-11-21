// The ONE place where the frontend knows how the four kinds of entries differ.
// It mirrors backend/Bshatfine.Domain/Entries/EntryKindRules.cs (and the limits
// of EntryTranslation.cs / Entry.cs): change both together. Everything else
// (admin form, admin list, public sections, entry page) reads this file.
//
// Category and status values are CODES; their wording lives in messages/*.json
// under "Entries.categories.<kind>.<code>" and "Entries.statuses.<code>".

import type { PhotoName } from "@/components/site/Photo";

export const ENTRY_KINDS = ["history", "project", "place", "service"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export const PROJECT_STATUSES = ["planned", "ongoing", "completed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const ENTRY_LANGUAGES = ["ar", "en"] as const;
export type EntryLanguage = (typeof ENTRY_LANGUAGES)[number];

// The public section an entry belongs to: its crumb and "back" link.
export type EntrySection = "discover" | "municipality" | "services";

type KindRule = {
  // Empty: the kind has no category (none may be sent).
  categories: readonly string[];
  usesStatus: boolean;
  usesYear: boolean;
  // Where it is shown on the public site (#anchor on that page).
  section: EntrySection;
  anchor: string;
  // Hero photo of an entry page when the entry has no cover.
  photo: PhotoName;
};

export const ENTRY_RULES = {
  history: {
    categories: [],
    usesStatus: false,
    usesYear: true,
    section: "discover",
    anchor: "story",
    photo: "aerial",
  },
  project: {
    categories: ["roads", "lighting", "water", "green-spaces", "environment", "buildings", "other"],
    usesStatus: true,
    usesYear: true,
    section: "municipality",
    anchor: "projects",
    photo: "golden",
  },
  place: {
    categories: ["heritage", "nature", "village-life"],
    usesStatus: false,
    usesYear: false,
    section: "discover",
    anchor: "places",
    photo: "sunset",
  },
  service: {
    categories: ["certificate", "permit", "fees"],
    usesStatus: false,
    usesYear: false,
    section: "services",
    anchor: "forms",
    photo: "street",
  },
} as const satisfies Record<EntryKind, KindRule>;

export type EntryCategory<K extends EntryKind> = (typeof ENTRY_RULES)[K]["categories"][number];

export const usesCategory = (kind: EntryKind) => ENTRY_RULES[kind].categories.length > 0;

// Same limits as the API (EntryTranslation.cs, Entry.cs).
export const ENTRY_TITLE_MAX = 200;
export const ENTRY_SUMMARY_MAX = 400;
export const ENTRY_BODY_MAX = 50_000;
export const ENTRY_YEAR_MIN = 1000;
export const ENTRY_YEAR_MAX = 2100;

// The design's status tag colours (globals.css .st-done / .st-on / .st-plan).
export const STATUS_CLASS: Record<ProjectStatus, string> = {
  completed: "st-done",
  ongoing: "st-on",
  planned: "st-plan",
};

// Default card photo of a place without a cover, by category.
export const PLACE_PHOTO: Record<EntryCategory<"place">, PhotoName> = {
  heritage: "gate",
  nature: "sunset",
  "village-life": "festival",
};

export const isEntryKind = (value: unknown): value is EntryKind =>
  typeof value === "string" && (ENTRY_KINDS as readonly string[]).includes(value);

export const isProjectStatus = (value: unknown): value is ProjectStatus =>
  typeof value === "string" && (PROJECT_STATUSES as readonly string[]).includes(value);

// A category code the kind really has (an unknown one is shown as nothing).
export function knownCategory<K extends EntryKind>(
  kind: K,
  value: string | null | undefined,
): EntryCategory<K> | null {
  return (ENTRY_RULES[kind].categories as readonly string[]).includes(value ?? "")
    ? (value as EntryCategory<K>)
    : null;
}

// Entry ids are GUIDs; anything else can never be an entry.
export const ENTRY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
