import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";
import { routing, type Locale } from "@/i18n/routing";
import { ENTRY_KINDS } from "@/config/entries";
import { getEntries, getNews, getPastEvents, getUpcomingEvents } from "@/lib/api";
import { siteUrl } from "@/lib/site-url";

// /sitemap.xml (robots.ts points here). Every public page in both languages,
// each with its ar/en alternates, plus the published news, entries and events
// read from the API. robots.ts disallows /admin and /api, so neither is listed.
//
// The API data is cached (cacheLife "hours": refreshed about once an hour). If
// the API cannot be reached, the static pages are still returned and that
// partial answer is only kept for a minute or so ("minutes"), so the full list
// comes back soon after the API does.

// Same fallback as robots.ts when SITE_URL is not set.
const FALLBACK_SITE_URL = "https://bshatfine.vercel.app";

// The public pages ("" = home). The planned pages (gallery, careers) are left
// out: they answer 404 in production.
const STATIC_PATHS = ["", "/discover", "/municipality", "/services", "/report", "/news", "/events", "/notices", "/contact"];

// The API's largest page size (NewsService / EventService clamp to 50), and a
// safety cap on the number of pages read.
const PAGE_SIZE = 50;
const MAX_PAGES = 40;

type Item = { path: string; lastModified?: string };

async function allPages<T>(load: (page: number) => Promise<{ items: T[]; totalPages: number }>): Promise<T[]> {
  const first = await load(1);
  const items = [...first.items];
  for (let page = 2; page <= Math.min(first.totalPages, MAX_PAGES); page++) {
    items.push(...(await load(page)).items);
  }
  return items;
}

// The API's items as paths without a locale. The lists are asked in Arabic:
// the API falls back to Arabic for a missing translation, so every published
// item is in them, and every item has a page in both languages.
async function apiItems(): Promise<Item[]> {
  "use cache";

  const lang = routing.defaultLocale;
  let complete = true;
  const part = async (load: () => Promise<Item[]>): Promise<Item[]> => {
    try {
      return await load();
    } catch {
      complete = false; // API down or answering with an error: leave this part out
      return [];
    }
  };

  const [news, entries, events] = await Promise.all([
    part(async () =>
      (await allPages((page) => getNews(lang, page, PAGE_SIZE))).map((n) => ({
        path: `/news/${encodeURIComponent(n.slug)}`,
        lastModified: n.publishedAt,
      })),
    ),
    // Every kind has its own page (/entries/<id>), linked from its section.
    part(async () =>
      (await Promise.all(ENTRY_KINDS.map((kind) => getEntries(kind, lang)))).flat().map((e) => ({
        path: `/entries/${e.id}`,
      })),
    ),
    // Upcoming (the API returns at most 50) and the whole past archive.
    part(async () => {
      const [upcoming, past] = await Promise.all([
        getUpcomingEvents(lang, PAGE_SIZE),
        allPages((page) => getPastEvents(lang, page, PAGE_SIZE)),
      ]);
      const ids = new Set([...upcoming, ...past].map((e) => e.id));
      return [...ids].map((id) => ({ path: `/events/${id}` }));
    }),
  ]);

  // The public lists of entries and events carry no date, so only news has a lastModified.
  if (complete) cacheLife("hours");
  else cacheLife("minutes");
  return [...news, ...entries, ...events];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (siteUrl()?.origin ?? FALLBACK_SITE_URL).replace(/\/+$/, "");
  const url = (locale: Locale, path: string) => `${base}/${locale}${path}`;

  const items: Item[] = [...STATIC_PATHS.map((path) => ({ path })), ...(await apiItems())];

  // One <url> per language, each listing both versions (and x-default: Arabic).
  return items.flatMap(({ path, lastModified }) => {
    const languages = {
      ...Object.fromEntries(routing.locales.map((l) => [l, url(l, path)])),
      "x-default": url(routing.defaultLocale, path),
    };
    return routing.locales.map((locale) => ({
      url: url(locale, path),
      ...(lastModified && { lastModified }),
      alternates: { languages },
    }));
  });
}
