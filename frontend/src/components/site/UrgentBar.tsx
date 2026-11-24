"use client";

import { useSyncExternalStore } from "react";
import { URGENT_DISMISSED_PREFIX } from "@/config/notices";
import { Link } from "@/i18n/navigation";

export type UrgentItem = {
  id: string;
  title: string;
  language: string;
  dir: "rtl" | "ltr" | "auto";
  area: string;
  // Already formatted on the server ("Valid until 20 December 2026, 18:00").
  until: string | null;
  untilIso: string | null;
};

// ---------- Closed notices: sessionStorage, keyed by notice id ----------
// A notice closed here stays hidden for the rest of this browser session only.
// A new notice has a new id, so it still appears. Storage can be unavailable
// (private mode, blocked cookies): then closing works on this page only.

const CHANGE = "urgent-notices-dismissed";
const memory = new Set<string>();

function readDismissed(): string {
  const ids = new Set(memory);
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(URGENT_DISMISSED_PREFIX)) ids.add(key.slice(URGENT_DISMISSED_PREFIX.length));
    }
  } catch {
    // sessionStorage unavailable: only what was closed on this page.
  }
  return [...ids].sort().join(",");
}

function dismiss(id: string) {
  memory.add(id);
  try {
    sessionStorage.setItem(`${URGENT_DISMISSED_PREFIX}${id}`, "1");
  } catch {
    // Not remembered beyond this page.
  }
  window.dispatchEvent(new Event(CHANGE));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// The server knows nothing about closed notices: it renders them all, and the
// script in UrgentNotices hides the closed ones before the first paint.
const serverSnapshot = () => "";

export function UrgentBar({
  items,
  label,
  kicker,
  closeLabel,
  closeText,
}: {
  items: UrgentItem[];
  label: string;
  kicker: string;
  // "Hide this notice: {title}" with the title filled in, per notice id.
  closeLabel: Record<string, string>;
  closeText: string;
}) {
  const dismissed = useSyncExternalStore(subscribe, readDismissed, serverSnapshot);
  const hidden = new Set(dismissed ? dismissed.split(",") : []);
  const visible = items.filter((n) => !hidden.has(n.id));
  if (visible.length === 0) return null;

  // A labelled region, NOT role="alert": it must not interrupt screen readers
  // on every page they open.
  return (
    <section className="urgent-bar" aria-label={label}>
      <ul>
        {visible.map((n) => (
          <li key={n.id} data-urgent-id={n.id}>
            <div className="wrap urgent-item">
              <p className="urgent-text" style={{ margin: 0 }}>
                <span className="urgent-kicker">{kicker}</span>
                <Link href={`/notices/${n.id}`} lang={n.language} dir={n.dir}>
                  {n.title}
                </Link>
                {n.area.trim() !== "" && (
                  <span className="urgent-meta" lang={n.language} dir={n.dir}>
                    {n.area}
                  </span>
                )}
                {n.until && n.untilIso && (
                  <span className="urgent-meta">
                    <time dateTime={n.untilIso}>{n.until}</time>
                  </span>
                )}
              </p>
              <button
                type="button"
                className="urgent-close"
                aria-label={closeLabel[n.id] ?? closeText}
                title={closeText}
                onClick={(e) => {
                  // Keep keyboard focus in the banner: on the next notice's
                  // close button, or the previous one's.
                  const li = e.currentTarget.closest("li");
                  const next = (li?.nextElementSibling ?? li?.previousElementSibling)?.querySelector("button");
                  dismiss(n.id);
                  if (next instanceof HTMLButtonElement) setTimeout(() => next.focus(), 0);
                }}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
