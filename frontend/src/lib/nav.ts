// Main navigation. `key` maps to messages "Nav.<key>"; `href` has no locale prefix.
export const navItems = [
  { key: "home", href: "/" },
  { key: "news", href: "/news" },
  { key: "events", href: "/events" },
  { key: "services", href: "/services" },
  { key: "contact", href: "/contact" },
] as const;

export const loginHref = "/login";
