"use client";

import Image from "next/image";
import { motion } from "motion/react";

// The hero photo. It is the only preloaded image on a page, and it settles
// very slowly from 1.04 to its real size once on load. With reduced motion,
// globals.css pins it at its real size.
export function HeroImage({ src, alt }: { src: string; alt: string }) {
  return (
    <motion.div
      className="hero-zoom"
      initial={{ scale: 1.04 }}
      animate={{ scale: 1 }}
      transition={{ duration: 7, ease: "easeOut" }}
    >
      <Image className="bg" src={src} alt={alt} fill preload sizes="100vw" />
    </motion.div>
  );
}
