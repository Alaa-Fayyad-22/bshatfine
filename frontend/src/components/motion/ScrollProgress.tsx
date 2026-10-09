"use client";

import { motion, useReducedMotion, useScroll } from "motion/react";

// Thin gold line at the very top. Its width is bound directly to scroll
// position (0 → 1), so it fills when scrolling down and empties when
// scrolling up with no extra code. Animates transform only.
export function ScrollProgress() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();

  if (reduce) return null;

  return (
    <motion.div
      aria-hidden
      data-scroll-progress
      style={{ scaleX: scrollYProgress }}
      // Grows from the start edge: left in LTR, right in RTL.
      className="fixed inset-x-0 top-0 z-50 h-[3px] origin-left bg-gold rtl:origin-right"
    />
  );
}
