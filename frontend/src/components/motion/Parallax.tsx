"use client";

import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

// Subtle vertical parallax for a photo. The frame stays put (and clips); the
// content inside is 20% taller and slides ±8% as the frame crosses the
// viewport, so it appears to move slower than the surrounding text. Driven by
// scroll position, so it reverses naturally. Vertical only, so no RTL mirroring.
export function Parallax({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      <motion.div
        data-scroll-motion
        style={reduce ? undefined : { y }}
        className="absolute inset-x-0 -top-[10%] h-[120%] will-change-transform"
      >
        {children}
      </motion.div>
    </div>
  );
}
