"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { isNavItemActive, type NavItem } from "@/config/navigation";
import { Link, usePathname } from "@/i18n/navigation";

// "More" dropdown of the desktop header (a disclosure: button + list of links).
// Opens on click; closes on Escape, outside click, focus leaving and selection.
export function MoreMenu({ items }: { items: readonly NavItem[] }) {
  const t = useTranslations("Nav");
  const th = useTranslations("Header");
  const pathname = usePathname();
  const panelId = useId();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Set by the arrow keys; applied once the panel is visible.
  const focusOnOpen = useRef<"first" | "last" | null>(null);

  // Navigating closes the menu (adjusting state while rendering, no effect).
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  const links = () =>
    Array.from(panelRef.current?.querySelectorAll<HTMLElement>("a") ?? []);

  useEffect(() => {
    if (!open) return;

    const wanted = focusOnOpen.current;
    focusOnOpen.current = null;
    const all = links();
    if (wanted === "first") all[0]?.focus();
    if (wanted === "last") all[all.length - 1]?.focus();

    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onFocusIn = (e: FocusEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }
    const isButton = e.target === buttonRef.current;
    if (isButton && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      if (open) links()[e.key === "ArrowDown" ? 0 : links().length - 1]?.focus();
      else {
        focusOnOpen.current = e.key === "ArrowDown" ? "first" : "last";
        setOpen(true);
      }
      return;
    }
    if (!open || isButton) return;
    const all = links();
    const index = all.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => {
      e.preventDefault();
      all[(to + all.length) % all.length]?.focus();
    };
    if (e.key === "ArrowDown") move(index + 1);
    else if (e.key === "ArrowUp") move(index - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(all.length - 1);
  };

  const hasActive = items.some((item) => isNavItemActive(pathname, item.href));

  return (
    <div ref={rootRef} onKeyDown={onKeyDown} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        data-active={hasActive || undefined}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap px-2 text-base font-medium underline-offset-8 hover:underline data-[active]:font-semibold data-[active]:underline xl:px-3"
      >
        {th("more")}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="square"
          aria-hidden
          className={`transition-transform duration-200 motion-reduce:transition-none ${
            open ? "rotate-180" : ""
          }`}
        >
          <path d="M2 5l5 5 5-5" />
        </svg>
      </button>

      {/* Hidden with the `hidden` attribute (no display class on this element),
          so closed links are out of the tab order and the accessibility tree. */}
      <div
        ref={panelRef}
        id={panelId}
        hidden={!open}
        className="absolute end-0 top-full z-10 mt-1 min-w-56 rounded-card border border-hairline bg-ivory p-2 text-ink"
      >
        <ul>
          {items.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isNavItemActive(pathname, item.href) ? "page" : undefined}
                className="flex min-h-11 items-center whitespace-nowrap rounded-control px-3 text-base font-medium hover:bg-sand aria-[current=page]:bg-sand aria-[current=page]:font-semibold"
              >
                {t(item.key)}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
