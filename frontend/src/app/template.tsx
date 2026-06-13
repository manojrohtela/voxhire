"use client";

import { motion } from "framer-motion";

/**
 * App Router template — re-mounts on each navigation, giving every route a
 * subtle enter transition. Kept short (220ms) and gentle so it feels premium,
 * not flashy. Respects prefers-reduced-motion via framer-motion defaults.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
