import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
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
