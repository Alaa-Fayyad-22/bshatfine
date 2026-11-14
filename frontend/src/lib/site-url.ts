// The public address of the site (for absolute links in metadata, e.g. the
// share image of an article). SITE_URL wins; on Vercel the production domain
// is known without configuration. null when unknown: callers then leave out
// whatever needs an absolute URL instead of guessing.
export function siteUrl(): URL | null {
  const raw =
    process.env.SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined);
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}
