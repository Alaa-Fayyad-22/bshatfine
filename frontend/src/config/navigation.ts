// The one navigation config: the header and its mobile menu read it. `key` is
// the message key in "Nav.<key>"; `href` has no locale prefix (the locale-aware
// <Link> from "@/i18n/navigation" adds it).

export type NavKey = "discover" | "municipality" | "services" | "news" | "events" | "contact";

export type NavItem = {
  key: NavKey;
  href: string;
  // Other paths that also highlight this item (Report belongs to Services).
  // Sub-pages always count, so an article (/news/some-slug) highlights News.
  alsoActive?: readonly string[];
};

// Exactly the six links of the approved design, in its order.
export const navItems: readonly NavItem[] = [
  { key: "discover", href: "/discover" },
  { key: "municipality", href: "/municipality" },
  { key: "services", href: "/services", alsoActive: ["/report"] },
  { key: "news", href: "/news" },
  { key: "events", href: "/events" },
  { key: "contact", href: "/contact" },
];

// Pages that exist but are not in the header:
//  - /tourism and /achievements: editable pages, reachable by their address;
//  - /history and /council: permanent redirects to /discover and /municipality
//    (see next.config.ts);
//  - planned pages (below): only a "coming soon" page exists. Reachable only in
//    development or when NEXT_PUBLIC_SHOW_PLANNED_NAV=true; otherwise 404.
export type PlannedNavKey = "gallery" | "careers";

// NODE_ENV and NEXT_PUBLIC_* are inlined at build time, so this is the same
// value on the server and in the browser bundle.
export const showPlanned =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_SHOW_PLANNED_NAV === "true";

// Phase 1 has staff login only, so it is not in the header (see Footer).
export const loginHref = "/admin/login";

const under = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

// `pathname` comes from usePathname() of "@/i18n/navigation": no locale prefix.
export function isNavItemActive(pathname: string, item: NavItem) {
  return under(pathname, item.href) || (item.alsoActive ?? []).some((h) => under(pathname, h));
}
