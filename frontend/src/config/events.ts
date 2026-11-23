// The ONE place where the frontend knows the event rules. It mirrors
// backend/Bshatfine.Domain/Events/Event.cs and EventTranslation.cs (categories,
// limits): change both together. The admin form, the admin list and the public
// pages all read this file.
//
// Categories are CODES; their wording lives in messages/*.json under
// "Events.categories.<code>" (shared by the public site and the admin).

export const EVENT_CATEGORIES = [
  "cultural",
  "religious",
  "sports",
  "municipal-meeting",
  "health",
  "other",
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const EVENT_LANGUAGES = ["ar", "en"] as const;
export type EventLanguage = (typeof EVENT_LANGUAGES)[number];

// The colour of a category's tag (globals.css .st-on / .st-done / .st-plan).
export const CATEGORY_CLASS: Record<EventCategory, string> = {
  cultural: "st-on",
  religious: "st-plan",
  sports: "st-done",
  "municipal-meeting": "st-plan",
  health: "st-done",
  other: "st-plan",
};

export const isEventCategory = (value: unknown): value is EventCategory =>
  typeof value === "string" && (EVENT_CATEGORIES as readonly string[]).includes(value);

// Same limits as the API (EventTranslation.cs, Event.cs).
export const EVENT_TITLE_MAX = 200;
export const EVENT_SUMMARY_MAX = 400;
export const EVENT_BODY_MAX = 50_000;
export const EVENT_LOCATION_MAX = 200;
export const EVENT_ORGANIZER_MAX = 200;
export const EVENT_MAP_URL_MAX = 500;
export const EVENT_YEAR_MIN = 2000;
export const EVENT_YEAR_MAX = 2100;

// Public lists.
export const PAST_PAGE_SIZE = 12;
export const HOME_UPCOMING = 3;

// Event ids are GUIDs; anything else can never be an event.
export const EVENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A map link is only ever shown or saved when it is a plain https:// address
// (same rule as the API: no quotes, spaces or angle brackets).
export function isSafeMapUrl(value: string | null | undefined): value is string {
  if (!value || !value.startsWith("https://") || value.length > EVENT_MAP_URL_MAX) return false;
  if (/["'<>\s]/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}
