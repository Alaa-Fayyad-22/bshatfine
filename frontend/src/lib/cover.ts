// Turns the API's relative coverImageUrl ("/api/files/<id>") into an absolute
// URL. Shared by the server pages and the browser admin form, so the base is
// NEXT_PUBLIC_API_URL (the only one browser code can read) with API_URL as the
// server-side fallback. next.config.ts reads the same variables, so the host
// allowed for next/image always matches the one built here.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:5246";

export function coverUrl(coverImageUrl: string | null | undefined): string | null {
  if (!coverImageUrl) return null;
  return `${API_BASE.replace(/\/+$/, "")}${coverImageUrl}`;
}
