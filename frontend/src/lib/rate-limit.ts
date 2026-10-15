// 429 helpers shared by the auth and admin clients.
//
// The API sends `Retry-After: <seconds>` with a rate-limit 429. A browser only
// lets JavaScript read that header on a cross-origin call when the API lists it
// in Access-Control-Expose-Headers; if it does not, the header reads as null and
// we fall back to the length of the API's rate-limit window (one minute).
export const FALLBACK_RETRY_SECONDS = 60;
const MAX_RETRY_SECONDS = 3600;

export function readRetryAfter(res: Response): number | null {
  const raw = res.headers.get("Retry-After");
  if (raw === null) return null;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.min(Math.max(Math.ceil(seconds), 1), MAX_RETRY_SECONDS);
}
