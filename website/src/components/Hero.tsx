"use client";

import { motion } from "framer-motion";
import PipelineScene from "./PipelineCanvas";
import AnimatedCounter from "./AnimatedCounter";

const floatingMetrics: {
  label: string;
  value: string;
  prefix?: string;
  suffix: string;
}[] = [
  { label: "Pipeline Stages", value: "10", suffix: "" },
  { label: "Videos / Week", value: "14", suffix: "+" },
  { label: "Oversight", value: "5", prefix: "<", suffix: "min" },
  { label: "QA Checks", value: "14", suffix: "" },
];

interface HeroProps {
  onOpenWaitlist: () => void;
}

export default function Hero({ onOpenWaitlist }: HeroProps) {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <PipelineScene />

      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-surface/30 to-surface pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          className="mb-6"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs tracking-widest text-white/50 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Autonomous Pipeline — Live
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
          className="font-display text-5xl md:text-7xl lg:text-8xl font-bold leading-[1.05] tracking-tight mb-6"
        >
          Your YouTube Channel.
          <br />
          <span className="text-gradient">Running Itself.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="max-w-2xl mx-auto text-lg md:text-xl text-white/50 leading-relaxed mb-10"
        >
          AutoTube sources topics, writes scripts, generates voice-over, assembles
          videos, creates thumbnails, writes SEO metadata, validates quality, and
          uploads to YouTube — entirely on autopilot.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <button
            onClick={onOpenWaitlist}
            className="group relative px-8 py-3.5 rounded-full bg-gradient-to-r from-accent-teal to-accent-cyan text-black font-semibold text-sm transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(45,212,191,0.3)]"
          >
            Build Your Channel
            <span className="ml-2 group-hover:translate-x-1 inline-block transition-transform">
              →
            </span>
          </button>
          <a
            href="#pipeline"
            className="px-8 py-3.5 rounded-full border border-white/10 text-white/70 text-sm hover:bg-white/5 hover:text-white/90 transition-all duration-300"
          >
            See the Pipeline
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex flex-wrap items-center justify-center gap-6"
        >
          {floatingMetrics.map(({ label, value, prefix, suffix }) => (
            <AnimatedCounter
              key={label}
              value={value}
              prefix={prefix ?? ""}
              suffix={suffix}
              label={label}
            />
          ))}
        </motion.div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="2"
        >
          <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
        </svg>
      </div>
    </section>
  );
}
