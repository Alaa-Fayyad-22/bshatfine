"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { isNavItemActive, navItems } from "@/config/navigation";
import { Link, usePathname } from "@/i18n/navigation";

const FOCUSABLE = "a[href], button:not([disabled])";

// The header of the approved design: it lies on top of the hero photo (every
// public page starts with one). Below 900px the six links fold into a panel
// opened by the Menu button. While that panel is open the page behind cannot
// scroll, Tab stays inside the header, and Escape, a link, navigating or
// leaving the mobile layout closes it and returns focus to the Menu button.
export function Header() {
  const t = useTranslations("Nav");
  const th = useTranslations("Header");
  const locale = useLocale();
  const pathname = usePathname();

  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Navigating to another page closes the menu (state adjusted while rendering).
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return;

    const html = document.documentElement;
    const body = document.body;
    const previous = { html: html.style.overflow, body: body.style.overflow };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMenuOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const header = headerRef.current;
      const focusable = Array.from(header?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!header?.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    // Leaving the mobile layout (e.g. rotating a tablet) closes the menu.
    const mq = window.matchMedia("(min-width: 901px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMenuOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    mq.addEventListener("change", onChange);
    const returnTo = buttonRef.current;
    return () => {
      html.style.overflow = previous.html;
      body.style.overflow = previous.body;
      document.removeEventListener("keydown", onKeyDown);
      mq.removeEventListener("change", onChange);
      returnTo?.focus({ preventScroll: true });
    };
  }, [menuOpen]);

  return (
    <header ref={headerRef} className="site-header">
      <div className="wrap">
        <Link className="brand" href="/">
          <Image
            src="/images/logo-white.png"
            alt={th("logoAlt")}
            width={648}
            height={275}
            sizes="170px"
            style={{ height: 72, width: "auto" }}
          />
        </Link>

        <nav
          className={menuOpen ? "mainnav open" : "mainnav"}
          id="mainnav"
          aria-label={th("mainNav")}
        >
          {navItems.map((item) => {
            const active = isNavItemActive(pathname, item);
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={active ? "active" : undefined}
                aria-current={active ? "page" : undefined}
              >
                {t(item.key)}
              </Link>
            );
          })}
        </nav>

        <div className="tools">
          {/* Both languages are always shown; the current one is underlined.
              The other one opens the same page in that language. */}
          <Link
            href={pathname}
            locale="ar"
            lang="ar"
            hrefLang="ar"
            className={locale === "ar" ? "current" : undefined}
            aria-current={locale === "ar" ? "true" : undefined}
          >
            عربي
          </Link>
          <span aria-hidden="true" style={{ opacity: 0.6 }}>
            /
          </span>
          <Link
            href={pathname}
            locale="en"
            lang="en"
            hrefLang="en"
            className={locale === "en" ? "current" : undefined}
            aria-current={locale === "en" ? "true" : undefined}
          >
            EN
          </Link>
          <button
            ref={buttonRef}
            type="button"
            className="menu-btn"
            aria-expanded={menuOpen}
            aria-controls="mainnav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {th("menu")}
          </button>
        </div>
      </div>
    </header>
  );
}
