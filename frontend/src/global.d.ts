import type { routing } from "@/i18n/routing";
import type ar from "../messages/ar.json";

// Makes t("...") keys and locale values type-checked (typos become TS errors).
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof ar;
  }
}
