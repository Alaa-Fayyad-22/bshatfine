import { defineRouting } from "next-intl/routing";

// Single source of truth for which languages exist.
export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  // Always show the prefix: /ar/... and /en/...
  localePrefix: "always",
  // The language cookie (it only holds "ar" or "en"):
  // sent only over https in production, and not with requests from other sites.
  // Locally (http) it still works, because Secure is only switched on in production.
  localeCookie: {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  },
});

export type Locale = (typeof routing.locales)[number];

// Arabic is right-to-left, English is left-to-right.
export function getDirection(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}