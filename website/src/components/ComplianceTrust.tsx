"use client";

import { motion } from "framer-motion";

const trustItems = [
  {
    title: "Licensed Media Only",
    desc: "All stock footage sourced from Pexels and Pixabay — fully licensed for commercial use. No copyrighted content.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent-teal">
        <path d="M9 12l2 2 4-4" />
        <path d="M12 2a10 10 0 0110 10c0 2.5-1 4.8-2.6 6.4" />
        <path d="M12 2a10 10 0 00-10 10c0 2.5 1 4.8 2.6 6.4" />
      </svg>
    ),
  },
  {
    title: "Attribution Handling",
    desc: "Automated attribution for all stock assets appended to video descriptions. No manual credit tracking needed.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent-cyan">
        <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    title: "AI Disclosure Compliance",
    desc: "Every video includes clear AI-generated content disclosure in metadata and descriptions. YouTube policy compliant.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent-indigo">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    title: "Content Guardrails",
    desc: "Keyword blacklists, topic filters, and QA validation prevent problematic content from being published.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent-violet">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    ),
  },
  {
    title: "Ethical Design",
    desc: "Built for educational content and niche expertise. Anti-patterns against spam, impersonation, and manipulation are enforced.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-success">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <path d="M22 4L12 14.01l-3-3" />
      </svg>
    ),
  },
  {
    title: "Transparent Operations",
    desc: "Full run logs, pipeline state visibility, and Telegram alerts. You always know what your channel is doing.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent-teal">
        <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
        <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
      </svg>
    ),
  },
];

export default function ComplianceTrust() {
  return (
    <section id="trust" className="relative py-32">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-xs tracking-widest text-white/30 uppercase mb-4 block">
            Trust by Design
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Compliance & <span className="text-gradient">Trust</span>
          </h2>
          <p className="max-w-xl mx-auto text-white/40 text-sm md:text-base">
            AutoTube is engineered for responsible content automation. Every output is checked, attributed, and disclosed.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {trustItems.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass rounded-2xl p-8 hover:bg-white/[0.03] transition-all duration-500 hover:scale-[1.02]"
            >
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                {item.icon}
              </div>
              <h3 className="font-display text-base font-semibold text-white/90 mb-2">
                {item.title}
              </h3>
              <p className="text-sm text-white/40 leading-relaxed">
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
