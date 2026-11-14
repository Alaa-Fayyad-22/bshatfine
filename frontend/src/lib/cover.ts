// The API returns file addresses as same-origin paths ("/api/files/<id>").
// The browser and next/image load them from this site's own origin, and the
// /api rewrite in next.config.ts forwards them to the API, so the path is used
// as it is: no API host is ever put in a page.
export function coverUrl(coverImageUrl: string | null | undefined): string | null {
  // Anything else than an API file path is ignored (no other host, no tricks).
  if (!coverImageUrl || !coverImageUrl.startsWith("/api/files/")) return null;
  return coverImageUrl;
}
