import { cacheLife } from "next/cache";
import { ENTRY_ID, type EntryKind } from "@/config/entries";
import { EVENT_ID } from "@/config/events";
import { API_INTERNAL_URL, upstreamHeaders } from "./api-upstream";

export type NewsDto = {
  id: string;
  slug: string;
  language: string;
  title: string;
  body: string;
  publishedAt: string;
  // A same-origin path (/api/files/...); pass it through coverUrl() (./cover).
  coverImageUrl: string | null;
};

// One row of the public list: a short excerpt (at most 300 characters, cut at a
// whole word, ending in "…" when the body was longer) and no body. `language`
// can differ from the requested one when that translation does not exist.
export type NewsSummaryDto = {
  id: string;
  slug: string;
  language: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  coverImageUrl: string | null;
};

export { coverUrl } from "./cover";

export type NewsPage = {
  items: NewsSummaryDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

// Server-side only (server components, the proxy's article check, "use cache"
// functions): a relative /api URL means nothing on the server, so these call
// the API directly. Browser code uses relative /api/... paths instead (see
// ./auth-api and ./admin-api), which src/proxy.ts forwards to the same API.
// Every call sends the proxy secret (when configured): with one set, the API
// refuses any request without it.
const API_URL = API_INTERNAL_URL;

export async function getNews(locale: string, page = 1, pageSize = 10): Promise<NewsPage> {
  const res = await fetch(`${API_URL}/api/news?lang=${locale}&page=${page}&pageSize=${pageSize}`, {
    headers: upstreamHeaders(),
    cache: "no-store",
    // Fail fast if the API is down so the page never hangs on it.
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`Failed to load news: ${res.status}`);
  }

  return res.json();
}

// Returns null when the article does not exist or is not published (404);
// any other failure throws so callers can show an "API down" state.
//
// Cached for a short time on purpose: the article page needs the answer
// before it renders so that an unknown slug gets a real HTTP 404. Under Cache
// Components, an uncached fetch there would make the route stream (and so
// answer 200). Thrown errors are never cached.
export async function getNewsBySlug(locale: string, slug: string): Promise<NewsDto | null> {
  "use cache";
  cacheLife("minutes");

  const res = await fetch(`${API_URL}/api/news/${encodeURIComponent(slug)}?lang=${locale}`, {
    headers: upstreamHeaders(),
    signal: AbortSignal.timeout(5000),
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to load news article: ${res.status}`);
  }

  return res.json();
}

// ---------- Entries (history, projects, places, services) ----------
// Lists, contact details and the council are read live (no-store) behind
// <Suspense>, so an edit in the admin shows up on the next visit. `signal`
// makes a dead API fail fast.

// One row of a public list: published only, in display order. `category` and
// `status` are codes (see src/config/entries.ts); null when the kind has none.
export type EntrySummaryDto = {
  id: string;
  kind: EntryKind;
  category: string | null;
  status: string | null;
  year: number | null;
  // Can differ from the requested language (fallback).
  language: string;
  title: string;
  summary: string;
  // A same-origin path (/api/files/...); pass it through coverUrl().
  coverImageUrl: string | null;
};

export type EntryDto = EntrySummaryDto & {
  // Markdown, may be empty. Always render it with <Markdown> (raw HTML is ignored there).
  body: string;
  updatedAt: string | null;
};

export async function getEntries(kind: EntryKind, locale: string): Promise<EntrySummaryDto[]> {
  const res = await fetch(`${API_URL}/api/entries?kind=${kind}&lang=${locale}`, {
    headers: upstreamHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Failed to load entries: ${res.status}`);
  return res.json();
}

// null when the entry is missing or unpublished (404); other failures throw.
// Cached briefly for the same reason as getNewsBySlug: the entry page must have
// the answer before it renders. The proxy checks existence live (entryExists).
export async function getEntry(locale: string, id: string): Promise<EntryDto | null> {
  "use cache";
  cacheLife("minutes");

  if (!ENTRY_ID.test(id)) return null;
  const res = await fetch(`${API_URL}/api/entries/${encodeURIComponent(id)}?lang=${locale}`, {
    headers: upstreamHeaders(),
    signal: AbortSignal.timeout(5000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load entry: ${res.status}`);
  return res.json();
}

// Live existence check for the proxy (same contract as newsExists below).
export async function entryExists(locale: string, id: string): Promise<boolean | null> {
  if (!ENTRY_ID.test(id)) return false;
  try {
    const res = await fetch(`${API_URL}/api/entries/${encodeURIComponent(id)}?lang=${locale}`, {
      headers: upstreamHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (res.status === 404) return false;
    return res.ok ? true : null;
  } catch {
    return null;
  }
}

// ---------- Events ----------
// Dates are UTC instants ("...Z"); show them with src/lib/event-time.ts, which
// always uses Beirut time. `category` is a code (src/config/events.ts).

export type EventSummaryDto = {
  id: string;
  category: string;
  startsAt: string;
  // All-day events: the start of the LAST day (inclusive).
  endsAt: string | null;
  isAllDay: boolean;
  // Can differ from the requested language (fallback).
  language: string;
  title: string;
  summary: string;
  // May be empty.
  location: string;
  // A same-origin path (/api/files/...); pass it through coverUrl().
  coverImageUrl: string | null;
};

export type EventDto = EventSummaryDto & {
  isPast: boolean;
  // Markdown, may be empty. Always render it with <Markdown>.
  body: string;
  // May be empty.
  organizer: string;
  // Only ever shown when it is an https:// address (isSafeMapUrl).
  mapUrl: string | null;
  updatedAt: string | null;
};

export type EventPage = {
  items: EventSummaryDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

// The lists are read live (no-store) behind <Suspense>, like the other lists:
// what is "upcoming" changes with the clock, and an edit shows up at once.
export async function getUpcomingEvents(locale: string, limit: number): Promise<EventSummaryDto[]> {
  const res = await fetch(`${API_URL}/api/events/upcoming?lang=${locale}&limit=${limit}`, {
    headers: upstreamHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Failed to load upcoming events: ${res.status}`);
  return res.json();
}

export async function getPastEvents(locale: string, page: number, pageSize: number): Promise<EventPage> {
  const res = await fetch(
    `${API_URL}/api/events/past?lang=${locale}&page=${page}&pageSize=${pageSize}`,
    { headers: upstreamHeaders(), cache: "no-store", signal: AbortSignal.timeout(5000) },
  );
  if (!res.ok) throw new Error(`Failed to load past events: ${res.status}`);
  return res.json();
}

// null when the event is missing or unpublished (404); other failures throw.
// Cached for the same reason as getEntry (the page needs the answer before it
// renders), but only briefly: at most about a minute old (`isPast` included).
// The proxy checks existence live first (eventExists).
export async function getEvent(locale: string, id: string): Promise<EventDto | null> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 30, expire: 60 });

  if (!EVENT_ID.test(id)) return null;
  const res = await fetch(`${API_URL}/api/events/${encodeURIComponent(id)}?lang=${locale}`, {
    headers: upstreamHeaders(),
    signal: AbortSignal.timeout(5000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load event: ${res.status}`);
  return res.json();
}

// Live existence check for the proxy (same contract as newsExists below).
export async function eventExists(locale: string, id: string): Promise<boolean | null> {
  if (!EVENT_ID.test(id)) return false;
  try {
    const res = await fetch(`${API_URL}/api/events/${encodeURIComponent(id)}?lang=${locale}`, {
      headers: upstreamHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (res.status === 404) return false;
    return res.ok ? true : null;
  } catch {
    return null;
  }
}

// ---------- Contact details, council ----------

// Any field may be null (never saved, or left empty).
export type SiteSettingsDto = {
  phone: string | null;
  secondaryPhone: string | null;
  email: string | null;
  address: string | null;
  openingHours: string | null;
  mapUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
};

// null when the API cannot be reached (the pages then simply show no details).
// Pages should call getSettings() from ./site-settings, which shares one
// request between the parts of a page that need it.
export async function getSiteSettings(locale: string): Promise<SiteSettingsDto | null> {
  try {
    const res = await fetch(`${API_URL}/api/site-settings?lang=${locale}`, {
      headers: upstreamHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export type CouncilMemberDto = {
  id: string;
  name: string;
  position: string;
  photoUrl: string | null;
};

export async function getCouncil(locale: string): Promise<CouncilMemberDto[]> {
  const res = await fetch(`${API_URL}/api/council?lang=${locale}`, {
    headers: upstreamHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Failed to load council: ${res.status}`);
  return res.json();
}

// Live (uncached) existence check, used by the proxy to answer an unknown slug
// with a real HTTP 404. Cache Components sends the page's static shell with a
// 200 before the page body resolves, so the page alone cannot set the status.
// true/false when the API answered 200/404; null when it could not be reached
// (the page then shows its own error state).
export async function newsExists(locale: string, slug: string): Promise<boolean | null> {
  try {
    const res = await fetch(`${API_URL}/api/news/${encodeURIComponent(slug)}?lang=${locale}`, {
      headers: upstreamHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (res.status === 404) return false;
    return res.ok ? true : null;
  } catch {
    return null;
  }
}
