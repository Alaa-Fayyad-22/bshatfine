// The one navigation config: the header, the mobile menu and the footer all
// read it. `key` is the message key in "Nav.<key>"; `href` has no locale
// prefix (the locale-aware <Link> from "@/i18n/navigation" adds it).
//
//  - status "live": the page exists and is shown everywhere.
//  - status "planned": only a "coming soon" page exists. Shown in menus (and
//    reachable) only in development or when NEXT_PUBLIC_SHOW_PLANNED_NAV=true;
//    otherwise hidden everywhere and its route answers 404.
//  - placement "primary": in the header row. "more": in the "More" dropdown
//    (header) / second group (mobile menu).

export type NavKey =
  | "home"
  | "news"
  | "services"
  | "events"
  | "council"
  | "contact"
  | "history"
  | "gallery"
  | "tourism"
  | "achievements"
  | "careers";

export type NavItem = {
  key: NavKey;
  href: string;
  status: "live" | "planned";
  placement: "primary" | "more";
};

export const navItems: readonly NavItem[] = [
  { key: "home", href: "/", status: "live", placement: "primary" },
  { key: "news", href: "/news", status: "live", placement: "primary" },
  { key: "services", href: "/services", status: "live", placement: "primary" },
  { key: "events", href: "/events", status: "planned", placement: "primary" },
  { key: "council", href: "/council", status: "live", placement: "primary" },
  { key: "contact", href: "/contact", status: "live", placement: "primary" },
  { key: "history", href: "/history", status: "live", placement: "more" },
  { key: "gallery", href: "/gallery", status: "planned", placement: "more" },
  { key: "tourism", href: "/tourism", status: "live", placement: "more" },
  { key: "achievements", href: "/achievements", status: "live", placement: "more" },
  { key: "careers", href: "/careers", status: "planned", placement: "more" },
];

// NODE_ENV and NEXT_PUBLIC_* are inlined at build time, so this is the same
// value on the server and in the browser bundle.
export const showPlanned =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_SHOW_PLANNED_NAV === "true";

export const visibleNavItems = navItems.filter(
  (item) => item.status === "live" || showPlanned,
);
export const primaryNavItems = visibleNavItems.filter((i) => i.placement === "primary");
export const moreNavItems = visibleNavItems.filter((i) => i.placement === "more");

export type PlannedNavKey = "events" | "gallery" | "careers";

// Phase 1 has staff login only, so it is not in the header (see Footer).
export const loginHref = "/admin/login";

// `pathname` comes from usePathname() of "@/i18n/navigation": no locale prefix.
// Sub-pages count too, so an article (/news/some-slug) highlights News.
export function isNavItemActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
