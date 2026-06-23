"use client";

import { motion } from "framer-motion";

const pipelineStates = [
  { stage: "Topic Queued", status: "completed" as const },
  { stage: "Scripting", status: "completed" as const },
  { stage: "TTS Generating", status: "completed" as const },
  { stage: "Media Fetching", status: "completed" as const },
  { stage: "Assembling", status: "active" as const },
  { stage: "Generating Thumbnail", status: "pending" as const },
  { stage: "Writing Metadata", status: "pending" as const },
  { stage: "QA Validation", status: "pending" as const },
  { stage: "Uploading", status: "pending" as const },
  { stage: "Completed", status: "pending" as const },
];

const statusColors: Record<string, string> = {
  completed: "bg-success",
  active: "bg-accent-teal animate-pulse",
  pending: "bg-white/10",
};

const logEntries = [
  { time: "14:32:01", level: "INFO", msg: "Pipeline run #1427 started — topic: 'The Future of Edge AI'" },
  { time: "14:32:04", level: "INFO", msg: "Script generated — 842 words, readability: 68.2" },
  { time: "14:32:12", level: "INFO", msg: "TTS audio rendered — 3m42s at 1.0x speed" },
  { time: "14:32:18", level: "INFO", msg: "Media fetched — 12 clips from Pexels + 4 images" },
  { time: "14:32:45", level: "INFO", msg: "Video assembled — 1920x1080, 23.97fps, H.264" },
  { time: "14:32:47", level: "INFO", msg: "Thumbnail generated — template: bold_text" },
  { time: "14:32:49", level: "INFO", msg: "Metadata written — AI disclosure appended" },
  { time: "14:32:52", level: "PASS", msg: "QA passed — 14/14 checks OK" },
  { time: "14:33:10", level: "INFO", msg: "Uploaded to YouTube — ID: dQw4w9WgXcQ" },
  { time: "14:33:12", level: "INFO", msg: "Pipeline run #1427 completed in 71.4s" },
];

export default function ProductProof() {
  return (
    <section id="proof" className="relative py-32">
      <div className="absolute inset-0 bg-gradient-to-b from-surface via-surface-light/30 to-surface pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <span className="text-xs tracking-widest text-white/30 uppercase mb-4 block">
            See It in Action
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Observable <span className="text-gradient">Operations</span>
          </h2>
          <p className="max-w-xl mx-auto text-white/40 text-sm md:text-base">
            Every run is logged, measured, and alertable. Total transparency into the autonomous pipeline.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6 }}
            className="glass rounded-2xl p-8"
          >
            <h3 className="font-display text-lg font-semibold text-white/90 mb-6">
              Pipeline State
            </h3>
            <div className="space-y-3">
              {pipelineStates.map((item) => (
                <div key={item.stage} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${statusColors[item.status]}`} />
                  <span
                    className={`text-sm ${
                      item.status === "completed"
                        ? "text-white/60"
                        : item.status === "active"
                        ? "text-white/90"
                        : "text-white/20"
                    }`}
                  >
                    {item.stage}
                  </span>
                  {item.status === "active" && (
                    <span className="text-[10px] text-accent-teal ml-auto">IN PROGRESS</span>
                  )}
                  {item.status === "completed" && (
                    <span className="text-[10px] text-success ml-auto">DONE</span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="glass rounded-2xl p-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-lg font-semibold text-white/90">
                Run Log
              </h3>
              <span className="text-[10px] text-white/30 font-mono">#1427</span>
            </div>
            <div className="space-y-2 font-mono text-[11px] leading-relaxed">
              {logEntries.map((entry, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-white/20 shrink-0">{entry.time}</span>
                  <span
                    className={`shrink-0 ${
                      entry.level === "PASS" ? "text-success" : "text-white/40"
                    }`}
                  >
                    [{entry.level}]
                  </span>
                  <span className="text-white/50 break-all">{entry.msg}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
