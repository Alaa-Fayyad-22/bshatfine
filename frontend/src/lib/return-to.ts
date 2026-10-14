import { routing } from "@/i18n/routing";

export const LOGIN_PATH = "/admin/login";
const MAX_LENGTH = 512;

// Where to send the user after signing in. `raw` comes from the URL, so it is
// untrusted: only a relative path inside /{locale}/admin is accepted; anything
// else (other sites, protocol-relative URLs, backslashes, "..", encoded tricks,
// other sections of the site, the login page itself, empty) gives the fallback.
export function safeReturnTo(raw: string | null | undefined, locale: string): string {
  const fallback = `/${locale}/admin/news`;
  if (typeof raw !== "string" || raw === "" || raw.length > MAX_LENGTH) return fallback;
  // Backslashes, control characters and any percent-encoding are not needed for
  // our own admin URLs (they only carry ?page=N), so they are refused outright.
  if (/[\\%\u0000-\u001f\u007f\s]/.test(raw)) return fallback;

  const locales = routing.locales.join("|");
  const shape = new RegExp(`^/(?:${locales})/admin(?:[/?].*)?$`);
  if (!shape.test(raw)) return fallback;

  // Let the URL parser have the last word: same origin, and still inside /admin
  // after dot segments are resolved.
  let url: URL;
  try {
    url = new URL(raw, "http://returnto.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "http://returnto.invalid") return fallback;
  if (!new RegExp(`^/(?:${locales})/admin(?:/|$)`).test(url.pathname)) return fallback;
  if (url.pathname.split("/").includes("..")) return fallback;
  if (new RegExp(`^/(?:${locales})/admin/login/?$`).test(url.pathname)) return fallback;

  return url.pathname + url.search;
}
