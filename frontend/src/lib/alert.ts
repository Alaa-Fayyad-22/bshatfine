import type { Locale } from "@/i18n/routing";

export type SiteAlert = {
  id: string;
  level: "warning" | "danger";
  text: Record<Locale, string>;
  href: string;
};

// PLACEHOLDER: static for now. A later milestone replaces this with live data
// from the API. Set to `null` to hide the bar.
export const siteAlert: SiteAlert | null = {
  id: "water-cut-demo",
  level: "warning",
  text: {
    ar: "انقطاع المياه في الحي الشرقي غداً من ٨ صباحاً حتى ٢ ظهراً",
    en: "Water cut in the eastern neighbourhood tomorrow, 8 am to 2 pm",
  },
  href: "/news",
};
