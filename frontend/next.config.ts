import type { NextConfig } from "next";

// Cover images are served by the API (GET /api/files/{id}); next/image may only
// load them from that host. Same variables as src/lib/cover.ts.
const apiUrl = new URL(
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:5246",
);
// Next refuses to optimize images from private addresses unless told otherwise;
// that is only needed when the API runs on this machine (development).
const apiIsLocal = ["localhost", "127.0.0.1", "[::1]"].includes(apiUrl.hostname);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
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
