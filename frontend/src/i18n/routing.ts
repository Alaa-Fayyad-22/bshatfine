import { defineRouting } from "next-intl/routing";

// Single source of truth for which languages exist.
export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  // Always show the prefix: /ar/... and /en/...
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

// Arabic is right-to-left, English is left-to-right.
export function getDirection(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}
