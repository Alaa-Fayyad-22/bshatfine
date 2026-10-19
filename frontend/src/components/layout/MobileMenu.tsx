"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useTranslations } from "next-intl";
import {
  isNavItemActive,
  moreNavItems,
  primaryNavItems,
  type NavItem,
} from "@/config/navigation";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";

const FOCUSABLE = "a[href], button:not([disabled])";

// Slide-in menu for screens below 1024px. It opens from the inline-start side
// (right in Arabic, left in English). While open it locks page scrolling, traps
// focus, closes on Escape / link click / leaving the mobile layout, and hands
// focus back to the burger button. The list scrolls inside the panel, so every
// item stays reachable on short screens (the page behind it cannot scroll).
export function MobileMenu({
  open,
  onClose,
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const t = useTranslations("Nav");
  const th = useTranslations("Header");
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const html = document.documentElement;
    const body = document.body;
    const previous = { html: html.style.overflow, body: body.style.overflow };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!panelRef.current?.contains(active)) {
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
    const mq = window.matchMedia("(min-width: 64rem)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    mq.addEventListener("change", onChange);
    const returnTo = returnFocusRef.current;
    return () => {
      html.style.overflow = previous.html;
      body.style.overflow = previous.body;
      document.removeEventListener("keydown", onKeyDown);
      mq.removeEventListener("change", onChange);
      returnTo?.focus({ preventScroll: true });
    };
  }, [open, onClose, returnFocusRef]);

  const renderItems = (items: readonly NavItem[]) => (
    <ul>
      {items.map((item) => (
        <li key={item.key} className="border-b border-hairline last:border-b-0">
          <Link
            href={item.href}
            onClick={onClose}
            aria-current={isNavItemActive(pathname, item.href) ? "page" : undefined}
            className="flex min-h-12 items-center border-s-2 border-transparent ps-3 text-lg font-medium aria-[current=page]:border-gold aria-[current=page]:font-bold aria-[current=page]:text-cedar"
          >
            {t(item.key)}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    // `inert` while closed: no focus, no clicks, hidden from assistive tech.
    // `invisible` is delayed by the slide duration so the exit still animates.
    <div
      inert={!open}
      className={`fixed inset-0 z-50 lg:hidden ${
        open
          ? "visible"
          : "pointer-events-none invisible delay-300 motion-reduce:delay-0"
      }`}
    >
      <div
        aria-hidden
        onClick={onClose}
        className={`absolute inset-0 bg-ink/40 transition-opacity duration-300 ease-soft motion-reduce:transition-none ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        ref={panelRef}
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label={th("mainNav")}
        className={`absolute inset-y-0 start-0 flex w-[min(22rem,88vw)] flex-col bg-ivory text-ink transition-transform duration-300 ease-soft motion-reduce:transition-none ${
          open ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
        }`}
      >
        <div className="flex h-18 shrink-0 items-center justify-between gap-3 border-b border-hairline px-4">
          <Link
            href="/"
            onClick={onClose}
            aria-label={th("homeLabel")}
            className="inline-flex min-h-11 items-center text-lg font-bold"
          >
            {t("brand")}
          </Link>
          <button
            ref={closeRef}
            type="button"
            aria-label={th("menuClose")}
            onClick={onClose}
            className="inline-flex size-11 shrink-0 items-center justify-center"
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
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </button>
        </div>

        <nav
          aria-label={th("mainNav")}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2"
        >
          {renderItems(primaryNavItems)}
          {moreNavItems.length > 0 && (
            <>
              <h2 className="mt-5 text-sm font-semibold text-ink/60">{th("more")}</h2>
              <div className="mt-1">{renderItems(moreNavItems)}</div>
            </>
          )}
        </nav>

        <div className="flex shrink-0 items-center border-t border-hairline px-4 py-2">
          <LocaleSwitcher />
        </div>
      </div>
    </div>
  );
}
