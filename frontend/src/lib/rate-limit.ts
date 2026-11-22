// 429 helpers shared by the auth and admin clients.
//
// The API sends `Retry-After: <seconds>` with a rate-limit 429. The browser
// calls the API through this site's own origin (/api, forwarded by src/proxy.ts), so the
// header is readable. If it is ever missing or invalid, we fall back to the
// length of the API's rate-limit window (one minute).
export const FALLBACK_RETRY_SECONDS = 60;
const MAX_RETRY_SECONDS = 3600;

export function readRetryAfter(res: Response): number | null {
  const raw = res.headers.get("Retry-After");
  if (raw === null) return null;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.min(Math.max(Math.ceil(seconds), 1), MAX_RETRY_SECONDS);
}
