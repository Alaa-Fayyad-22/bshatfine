"use client";

import { useRef, type ReactNode } from "react";
import {
  cubicBezier,
  motion,
  useScroll,
  useTransform,
} from "motion/react";
import { useReducedMotion } from "./useReducedMotion";
import { useLocale } from "next-intl";
import { getDirection, type Locale } from "@/i18n/routing";

const ease = cubicBezier(0.22, 0.61, 0.36, 1);

// Reveals its content with an expanding clip-path as it scrolls into view,
// and collapses it again when it scrolls back out (not a one-shot animation:
// the clip is a function of scroll position). The reveal grows from the START
// edge, so it mirrors in RTL.
export function ClipReveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const rtl = getDirection(useLocale() as Locale) === "rtl";

  // 0 when the top of the element reaches 95% of the viewport height (just
  // entering), 1 when it reaches 40% (comfortably in view).
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.95", "start 0.4"],
  });

  const closed = rtl ? "inset(0% 0% 0% 100%)" : "inset(0% 100% 0% 0%)";
  const clipPath = useTransform(
    scrollYProgress,
    [0, 1],
    [closed, "inset(0% 0% 0% 0%)"],
    { ease },
  );

  return (
    <motion.div
      ref={ref}
      data-scroll-motion
      style={reduce ? undefined : { clipPath }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
