"use client";

import { motion, useScroll, useSpring } from "framer-motion";

export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleY = useSpring(scrollYProgress, { stiffness: 200, damping: 30 });

  return (
    <motion.div
      className="fixed right-0 top-0 bottom-0 w-[2px] z-50 origin-top"
      style={{ scaleY }}
    >
      <div className="w-full h-full bg-gradient-to-b from-accent-teal via-accent-cyan to-accent-indigo" />
    </motion.div>
  );
}
