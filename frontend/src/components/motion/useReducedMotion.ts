"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

// Hydration-safe version of motion's useReducedMotion. The server (and the
// first client render, while hydrating) assume "no preference", so the HTML
// matches; React then re-renders with the real value. motion's own hook reads
// the media query during the first client render, which disagrees with the
// server HTML for users who prefer reduced motion and causes a hydration error.
// globals.css also forces the static end state in CSS, so nothing flashes.
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
