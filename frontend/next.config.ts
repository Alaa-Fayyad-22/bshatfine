import type { NextConfig } from "next";

// Cover images are served by the API (GET /api/files/{id}); next/image may only
// load them from that host. Same variables as src/lib/cover.ts.
const apiUrl = new URL(
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:5246",
);
// Next refuses to optimize images from private addresses unless told otherwise;
// that is only needed when the API runs on this machine (development).
const apiIsLocal = ["localhost", "127.0.0.1", "[::1]"].includes(apiUrl.hostname);

const isDev = process.env.NODE_ENV !== "production";
// The API host the browser talks to (fetch with the session cookie) and loads
// cover images from. Same variable as above, so there is one place to change it.
const apiOrigin = apiUrl.origin;

// Content-Security-Policy, only what the site really needs:
//  - scripts/styles: its own files, plus the small inline scripts and styles
//    Next.js writes into every page. A nonce would avoid 'unsafe-inline', but a
//    nonce needs every page rendered per request, which this site's static
//    rendering (cacheComponents) rules out. Dev also needs 'unsafe-eval' (React
//    debugging), production does not.
//  - fonts: next/font self-hosts them, so 'self'.
//  - images: its own, next/image (served from 'self' via /_next/image), data:
//    and blob: for previews, and the API host for covers.
//  - fetch/XHR: itself and the API. In dev also the websocket for hot reload.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${apiOrigin}`,
  "font-src 'self'",
  `connect-src 'self' ${apiOrigin}${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // An https API means an https site: refuse to load anything over plain http.
  ...(!isDev && apiUrl.protocol === "https:" ? ["upgrade-insecure-requests"] : []),
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
  images: {
    remotePatterns: [
      {
        protocol: apiUrl.protocol.replace(":", "") as "http" | "https",
        hostname: apiUrl.hostname,
        port: apiUrl.port,
        pathname: "/api/files/**",
      },
    ],
    dangerouslyAllowLocalIP: apiIsLocal,
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
