"use client";

import { motion } from "framer-motion";

export default function CTA() {
  return (
    <section id="cta" className="relative py-40 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-surface via-surface-light/20 to-surface pointer-events-none" />

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-accent-teal/5 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-accent-indigo/5 blur-[100px] pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-xs tracking-widest text-white/30 uppercase mb-6 block">
            Ready to Build?
          </span>

          <h2 className="font-display text-4xl md:text-6xl font-bold leading-[1.1] mb-6">
            Put Your Publishing
            <br />
            <span className="text-gradient">on Autopilot</span>
          </h2>

          <p className="max-w-lg mx-auto text-white/40 text-base md:text-lg leading-relaxed mb-10">
            From topic queue to published video. Zero oversight. Zero monthly cost. Your channel, running itself.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.a
              href="#"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              className="group relative px-10 py-4 rounded-full bg-gradient-to-r from-accent-teal to-accent-cyan text-black font-semibold text-sm transition-all duration-300 hover:shadow-[0_0_60px_rgba(45,212,191,0.3)]"
            >
              Build Your Channel
              <span className="ml-2 group-hover:translate-x-1 inline-block transition-transform">
                →
              </span>
            </motion.a>
            <motion.a
              href="#"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              className="px-10 py-4 rounded-full border border-white/10 text-white/70 text-sm hover:bg-white/5 hover:text-white/90 transition-all duration-300"
            >
              View Technical Architecture
            </motion.a>
          </div>

          <p className="mt-8 text-xs text-white/20">
            No credit card required. No hidden fees. Just clone and deploy.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
