import { cacheLife } from "next/cache";

export type NewsDto = {
  id: string;
  slug: string;
  language: string;
  title: string;
  body: string;
  publishedAt: string;
  // Relative to the API base; turn it into a URL with coverUrl() (./cover).
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

const API_URL = process.env.API_URL ?? "http://localhost:5246";

export async function getNews(locale: string, page = 1, pageSize = 10): Promise<NewsPage> {
  const res = await fetch(`${API_URL}/api/news?lang=${locale}&page=${page}&pageSize=${pageSize}`, {
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
    signal: AbortSignal.timeout(5000),
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to load news article: ${res.status}`);
  }

  return res.json();
}

// ---------- Editable pages, contact details, council ----------
// All three are read live (no-store) behind <Suspense>, so an edit in the admin
// shows up on the next visit. `signal` makes a dead API fail fast.

export type PageDto = {
  key: string;
  // Can differ from the requested language (fallback).
  language: string;
  title: string;
  // Markdown. Always render it with <Markdown> (raw HTML is ignored there).
  body: string;
  updatedAt: string | null;
  coverImageUrl: string | null;
};

// null when the page is missing or unpublished (404); other failures throw.
export async function getPage(key: string, locale: string): Promise<PageDto | null> {
  const res = await fetch(`${API_URL}/api/pages/${encodeURIComponent(key)}?lang=${locale}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load page: ${res.status}`);
  return res.json();
}

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

// null when the API cannot be reached (the footer then simply shows no details).
export async function getSiteSettings(locale: string): Promise<SiteSettingsDto | null> {
  try {
    const res = await fetch(`${API_URL}/api/site-settings?lang=${locale}`, {
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
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (res.status === 404) return false;
    return res.ok ? true : null;
  } catch {
    return null;
  }
}
