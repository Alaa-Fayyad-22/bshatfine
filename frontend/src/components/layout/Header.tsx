"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { loginHref, navItems } from "@/lib/nav";
import { LocaleSwitcher } from "./LocaleSwitcher";

// Keep in sync with h-18 below (4.5rem = 72px).
const HEADER_HEIGHT = 72;

const mobileItems = [
  ...navItems.map(({ key, href }) => ({ key, href })),
  { key: "login" as const, href: loginHref },
];

export function Header() {
  const t = useTranslations("Nav");
  const th = useTranslations("Header");
  const pathname = usePathname();
  const isHome = pathname === "/";

  const [pastHero, setPastHero] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Scroll position drives the header state. Because we recompute from the
  // current position on every scroll, scrolling back to the top reverses it.
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => {
    const hero = document.getElementById("hero");
    setPastHero(hero ? y > hero.offsetHeight - HEADER_HEIGHT : true);
  });

  // Solid whenever there is no hero behind it (inner pages), after the hero,
  // or while the mobile menu is open (so the menu button stays readable).
  const solid = !isHome || pastHero || menuOpen;

  useEffect(() => {
    if (!menuOpen) return;

    const links = panelRef.current?.querySelectorAll<HTMLElement>("a") ?? [];
    links[0]?.focus();
    document.documentElement.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (e.key !== "Tab" || links.length === 0) return;
      // Keep Tab cycling between the menu button and the menu links.
      const first = buttonRef.current;
      const last = links[links.length - 1];
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    };

    // Leaving the mobile layout (e.g. rotating a tablet) closes the menu.
    const mq = window.matchMedia("(min-width: 64rem)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMenuOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    mq.addEventListener("change", onChange);
    return () => {
      document.documentElement.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
      mq.removeEventListener("change", onChange);
    };
  }, [menuOpen]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      data-solid={solid}
      // Text colour flips at the midpoint of the 300ms background fade
      // (no colour animation: only the background layer's opacity animates).
      className={`sticky top-0 z-40 h-18 transition-colors delay-150 duration-0 ${
        solid ? "text-ink" : "on-cedar text-ivory"
      }`}
    >
      <div
        aria-hidden
        className={`absolute inset-0 border-b border-hairline bg-ivory transition-opacity duration-300 ease-soft motion-reduce:transition-none ${
          solid ? "opacity-100" : "opacity-0"
        }`}
      />

      <div className="page-container relative flex h-full items-center justify-between gap-4">
        <Link
          href="/"
          aria-label={th("homeLabel")}
          className="inline-flex min-h-11 items-center text-lg font-bold md:text-xl"
        >
          {t("brand")}
        </Link>

        <nav aria-label={th("mainNav")} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {navItems.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className="inline-flex min-h-11 items-center px-3 text-base font-medium underline-offset-8 hover:underline aria-[current=page]:font-semibold aria-[current=page]:underline"
                >
                  {t(item.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <Link
            href={loginHref}
            className="hidden min-h-11 items-center rounded-control border border-current px-4 text-base font-medium hover:bg-current/10 lg:inline-flex"
          >
            {t("login")}
          </Link>
          <button
            ref={buttonRef}
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? th("menuClose") : th("menuOpen")}
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex size-11 items-center justify-center lg:hidden"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="square"
              aria-hidden
            >
              {menuOpen ? (
                <path d="M5 5l14 14M19 5L5 19" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu: always in the DOM so it can fade; `invisible` removes it
          from the tab order and the accessibility tree while closed. */}
      <div
        ref={panelRef}
        id="mobile-menu"
        className={`absolute inset-x-0 top-full border-b border-hairline bg-ivory text-ink transition-[opacity,translate,visibility] duration-300 ease-soft motion-reduce:transition-none lg:hidden ${
          menuOpen
            ? "visible translate-y-0 opacity-100"
            : "pointer-events-none invisible -translate-y-2 opacity-0 motion-reduce:translate-y-0"
        }`}
      >
        <nav aria-label={th("mainNav")} className="page-container py-2">
          <ul>
            {mobileItems.map((item) => (
              <li
                key={item.key}
                className="border-b border-hairline last:border-b-0"
              >
                <Link
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className="flex min-h-14 items-center text-lg font-medium aria-[current=page]:font-bold"
                >
                  {t(item.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
