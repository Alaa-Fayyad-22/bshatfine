import type { NextConfig } from "next";

// The API, as the Next.js SERVER reaches it (never sent to the browser). The
// browser only ever talks to this site's own origin: /api/* is forwarded here
// by the rewrite below, so the session cookie is first-party and there is no
// cross-origin request (no CORS, Retry-After readable) behind any public URL.
// Same variable as src/lib/api.ts.
const apiInternalUrl = (process.env.API_INTERNAL_URL ?? "http://localhost:5246").replace(/\/+$/, "");

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
  experimental: {
    // Next.js buffers a request body before forwarding it through the /api
    // rewrite and silently cuts it at this size (default 10 MB). Uploads go up
    // to 10 MB plus the multipart wrapper, so allow what the API accepts (its
    // own limit is 11 MB, see backend Program.cs).
    proxyClientMaxBodySize: "11mb",
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Old addresses whose content moved: the village history is told on Discover,
  // and the council members are on the Municipality page. Permanent (308), and
  // the language prefix is kept.
  async redirects() {
    return [
      { source: "/:locale(ar|en)/history", destination: "/:locale/discover", permanent: true },
      { source: "/:locale(ar|en)/council", destination: "/:locale/municipality", permanent: true },
    ];
  },
  async rewrites() {
    return {
      // Before anything else, so /api/* can never be taken for a page (such as
      // the [locale] route). The request and response pass through as they are:
      // method, body, cookies, Set-Cookie, Retry-After, Cache-Control.
      beforeFiles: [{ source: "/api/:path*", destination: `${apiInternalUrl}/api/:path*` }],
    };
  },
  images: {
    // Only the site's own photos and the files the API serves (covers, council
    // photos), both same-origin paths. /api/files/* reaches the API through the
    // rewrite above, so no remote host needs to be allowed.
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
