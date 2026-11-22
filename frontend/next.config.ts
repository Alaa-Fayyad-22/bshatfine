import type { NextConfig } from "next";

// The browser only ever talks to this site's own origin: src/proxy.ts forwards
// /api/* to the API (API_INTERNAL_URL, see src/lib/api-upstream.ts), so the
// session cookie is first-party and there is no cross-origin request (no CORS,
// Retry-After readable) behind any public URL. The proxy, not a rewrite here,
// does the forwarding because it must add headers the API trusts.

// The public address of the site, when known (see src/lib/site-url.ts).
const siteUrl =
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined);

const isDev = process.env.NODE_ENV !== "production";

// Content-Security-Policy, only what the site really needs:
//  - scripts/styles: its own files, plus the small inline scripts and styles
//    Next.js writes into every page. A nonce would avoid 'unsafe-inline', but a
//    nonce needs every page rendered per request, which this site's static
//    rendering (cacheComponents) rules out. Dev also needs 'unsafe-eval' (React
//    debugging), production does not.
//  - fonts: next/font self-hosts them, so 'self'.
//  - images: its own (photos, /_next/image, API files via /api/files), data:
//    and blob: for previews in the admin forms.
//  - fetch/XHR: only this origin (the API is behind /api). In dev also the
//    websocket for hot reload.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Served over https (tunnel, Vercel): refuse to load anything over plain http.
  ...(!isDev && siteUrl?.startsWith("https:") ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // No "X-Powered-By: Next.js": don't advertise what we run.
  poweredByHeader: false,
  experimental: {
    // Next.js buffers a request body before it goes through src/proxy.ts
    // (which forwards /api/*) and silently cuts it at this size (default
    // 10 MB). Uploads are at most 4 MB plus the multipart wrapper; the proxy
    // answers 413 above 4.5 MB (Vercel's own limit), so this only has to be
    // a little larger than that.
    proxyClientMaxBodySize: "5mb",
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Old addresses whose content moved: the village history and the places to
  // see are on Discover, the council members and the projects (once the
  // "achievements" page) on the Municipality page. Permanent (308), and the
  // language prefix is kept.
  async redirects() {
    return [
      { source: "/:locale(ar|en)/history", destination: "/:locale/discover", permanent: true },
      { source: "/:locale(ar|en)/council", destination: "/:locale/municipality", permanent: true },
      { source: "/:locale(ar|en)/tourism", destination: "/:locale/discover#places", permanent: true },
      {
        source: "/:locale(ar|en)/achievements",
        destination: "/:locale/municipality#projects",
        permanent: true,
      },
    ];
  },
  images: {
    // Only the site's own photos and the files the API serves (covers, council
    // photos), both same-origin paths. /api/files/* reaches the API through
    // src/proxy.ts, so no remote host needs to be allowed.
    localPatterns: [
      { pathname: "/images/**", search: "" },
      { pathname: "/api/files/**", search: "" },
    ],
  },
  turbopack: {
    // Normally `createNextIntlPlugin()` from "next-intl/plugin" adds this alias.
    // That plugin imports @swc/core, which fails to load on this machine (the
    // Windows AppData\Local folder grants "Everyone" full control, and SWC
    // refuses to use its cache there). The alias is all next-intl needs under
    // Turbopack: it points next-intl at our request config.
    // If the SWC problem is ever fixed, this can be replaced by the plugin.
    resolveAlias: {
      "next-intl/config": "./src/i18n/request.ts",
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
