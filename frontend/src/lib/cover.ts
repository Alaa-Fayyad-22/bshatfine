// The API returns file addresses as same-origin paths ("/api/files/<id>").
// The browser loads them from this site's own origin, and the /api forwarding
// in src/proxy.ts sends them on to the API, so the path is used as it is: no
// API host is ever put in a page. Render them with SiteImage
// (src/components/SiteImage.tsx), which keeps them out of the image optimizer.
export function coverUrl(coverImageUrl: string | null | undefined): string | null {
  // Anything else than an API file path is ignored (no other host, no tricks).
  if (!coverImageUrl || !coverImageUrl.startsWith("/api/files/")) return null;
  return coverImageUrl;
}
