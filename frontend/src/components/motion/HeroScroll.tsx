"use client";

import { useRef, type ReactNode } from "react";
import {
  cubicBezier,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";

const ease = cubicBezier(0.22, 0.61, 0.36, 1);

// Scroll-linked hero. `scrollYProgress` is 0 when the hero sits at the top of
// the page and 1 once it has fully scrolled out. Every value below is a pure
// function of that number, so scrolling back up replays it in reverse.
//   - media (photo + overlay) scales 1 → 1.12
//   - content drifts up and fades out
// Only transform and opacity are animated.
export function HeroScroll({
  media,
  children,
  className = "",
  contentClassName = "",
}: {
  media: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.12], { ease });
  const y = useTransform(scrollYProgress, [0, 1], [0, -96], { ease });
  const opacity = useTransform(scrollYProgress, [0, 0.65], [1, 0], { ease });

  return (
    <section ref={ref} id="hero" className={className}>
      <motion.div
        data-scroll-motion
        style={reduce ? undefined : { scale }}
        className="absolute inset-0 will-change-transform"
      >
        {media}
      </motion.div>
      <motion.div
        data-scroll-motion
        style={reduce ? undefined : { y, opacity }}
        className={contentClassName}
      >
        {children}
      </motion.div>
    </section>
  );
}
