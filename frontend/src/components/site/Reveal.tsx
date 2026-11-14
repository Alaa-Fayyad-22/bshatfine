"use client";

import { useEffect } from "react";

const SELECTOR = "[data-reveal]";
// "Near the viewport": a block whose top is less than this far below the
// bottom edge counts as on screen (so blocks just below the fold never hide).
const MARGIN = 40;
const STAGGER_MS = 70;
const KEYFRAMES: Keyframe[] = [
  { opacity: 0, transform: "translateY(16px)" },
  { opacity: 1, transform: "translateY(0)" },
];

// The one scroll animation of the site: anything marked `data-reveal` fades in
// and rises 16px, once, when its top reaches the viewport (0.6s ease-out, with
// a small stagger between neighbours revealed together).
//
// How it stays safe:
//  - The server HTML is always fully visible (works without JavaScript).
//  - The hidden state is a paused Web Animation, not a style or class. It never
//    changes an element's attributes, so it cannot cause a hydration mismatch,
//    even on streamed sections React has not hydrated yet.
//  - Only after mount, and only blocks below the viewport, get hidden. Blocks
//    in, near or above the viewport are left alone.
//  - It checks the top edge against the window height on scroll/resize, so tall
//    blocks, cards inside the horizontal rail (which an IntersectionObserver
//    would see as clipped) and a page restored halfway down all reveal.
//  - Cleanup cancels every pending animation. (React Strict Mode mounts effects
//    twice in development; a leftover paused animation from the first mount is
//    what used to keep blocks invisible.)
//  - prefers-reduced-motion: nothing is ever hidden or animated.
export function Reveal() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;

    const pending = new Map<Element, Animation>();
    const settled = new WeakSet<Element>();

    const isNear = (el: Element) => el.getBoundingClientRect().top < window.innerHeight + MARGIN;

    const prepare = (el: Element) => {
      if (settled.has(el) || pending.has(el)) return;
      if (isNear(el)) {
        settled.add(el);
        return;
      }
      const animation = el.animate(KEYFRAMES, {
        duration: 600,
        easing: "ease-out",
        fill: "backwards",
      });
      animation.pause();
      pending.set(el, animation);
    };

    // Reads all positions first, then starts the animations (no layout thrash).
    const check = () => {
      const due: Element[] = [];
      for (const [el, animation] of pending) {
        if (!el.isConnected) {
          animation.cancel();
          pending.delete(el);
        } else if (isNear(el)) {
          due.push(el);
        }
      }
      const perParent = new Map<Element | null, number>();
      for (const el of due) {
        const index = perParent.get(el.parentElement) ?? 0;
        perParent.set(el.parentElement, index + 1);
        const animation = pending.get(el)!;
        animation.effect?.updateTiming({ delay: Math.min(index, 5) * STAGGER_MS });
        animation.play();
        pending.delete(el);
        settled.add(el);
      }
    };

    let frame = 0;
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        check();
      });
    };

    const scan = (root: ParentNode) => root.querySelectorAll(SELECTOR).forEach(prepare);
    scan(document);

    // Content that arrives later (streamed sections, the next page after a
    // navigation) gets the same treatment.
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches(SELECTOR)) prepare(node);
          scan(node);
        });
      }
      schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Turning "reduce motion" on while the page is open shows everything.
    const showAll = () => {
      for (const animation of pending.values()) animation.cancel();
      pending.clear();
    };
    const onReduce = (e: MediaQueryListEvent) => {
      if (e.matches) showAll();
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduce.addEventListener("change", onReduce);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reduce.removeEventListener("change", onReduce);
      cancelAnimationFrame(frame);
      showAll();
    };
  }, []);

  return null;
}
