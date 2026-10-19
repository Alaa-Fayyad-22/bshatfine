"use client";

import { useCallback, useRef, useState } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";
import { useTranslations } from "next-intl";
import {
  isNavItemActive,
  moreNavItems,
  primaryNavItems,
} from "@/config/navigation";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { MobileMenu } from "./MobileMenu";
import { MoreMenu } from "./MoreMenu";

// Keep in sync with h-18 below (4.5rem = 72px).
const HEADER_HEIGHT = 72;

export function Header() {
  const t = useTranslations("Nav");
  const th = useTranslations("Header");
  const pathname = usePathname();
  const isHome = pathname === "/";

  const [pastHero, setPastHero] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // Navigating to another page closes the mobile menu.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMenuOpen(false);
  }

  // Scroll position drives the header state. Because we recompute from the
  // current position on every scroll, scrolling back to the top reverses it.
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => {
    const hero = document.getElementById("hero");
    setPastHero(hero ? y > hero.offsetHeight - HEADER_HEIGHT : true);
  });

  // Solid whenever there is no hero behind it (inner pages) or after the hero.
  const solid = !isHome || pastHero;

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
          className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap text-lg font-bold md:text-xl"
        >
          {t("brand")}
        </Link>

        <nav aria-label={th("mainNav")} className="hidden lg:block">
          <ul className="flex items-center xl:gap-1">
            {primaryNavItems.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={isNavItemActive(pathname, item.href) ? "page" : undefined}
                  className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-base font-medium underline-offset-8 hover:underline aria-[current=page]:font-semibold aria-[current=page]:underline xl:px-3"
                >
                  {t(item.key)}
                </Link>
              </li>
            ))}
            {moreNavItems.length > 0 && (
              <li>
                <MoreMenu items={moreNavItems} />
              </li>
            )}
          </ul>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {/* Below 1024px the language switcher lives inside the mobile menu. */}
          <div className="hidden lg:block">
            <LocaleSwitcher />
          </div>
          <button
            ref={buttonRef}
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={th("menuOpen")}
            onClick={() => setMenuOpen(true)}
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
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </div>

      <MobileMenu open={menuOpen} onClose={closeMenu} returnFocusRef={buttonRef} />
    </header>
  );
}
