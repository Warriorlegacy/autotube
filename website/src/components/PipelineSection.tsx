"use client";

import { motion } from "framer-motion";

const stages = [
  { num: "01", title: "Topic Queue", desc: "AI ingests trending topics via RSS and Supabase. Configurable sources, keyword filters, and scheduling rules.", color: "from-accent-teal to-accent-cyan" },
  { num: "02", title: "Script Generation", desc: "Gemini Flash writes research-backed scripts with JSON structure. Groq fallback ensures reliability.", color: "from-accent-cyan to-accent-indigo" },
  { num: "03", title: "Voice Synthesis", desc: "Edge-TTS generates natural narration from scripts. Multiple voice profiles with configurable pacing.", color: "from-accent-indigo to-accent-violet" },
  { num: "04", title: "Media Retrieval", desc: "Pexels + Pixabay APIs fetch relevant stock footage and images. Keyword extraction from scripts.", color: "from-accent-violet to-accent-teal" },
  { num: "05", title: "Video Assembly", desc: "FFmpeg concatenates clips, mixes narration with background audio, burns subtitles with precise timing.", color: "from-accent-teal to-success" },
  { num: "06", title: "Thumbnail Design", desc: "Pillow generates YouTube-optimized thumbnails with dynamic templates, text wrapping, and drop shadows.", color: "from-success to-accent-cyan" },
  { num: "07", title: "Metadata & SEO", desc: "AI generates titles, descriptions, tags, and hashtags. AI disclosure and attribution appended automatically.", color: "from-accent-cyan to-accent-teal" },
  { num: "08", title: "Quality Assurance", desc: "14-point validation checks duration, codec, file size, audio tracks, metadata, and blacklisted keywords.", color: "from-accent-indigo to-accent-teal" },
  { num: "09", title: "YouTube Upload", desc: "Resumable chunked upload via YouTube Data API v3 with retry logic. Thumbnail and metadata set atomically.", color: "from-accent-teal to-accent-cyan" },
  { num: "10", title: "Monitoring & Alerts", desc: "Telegram notifications for success, failure, quota warnings. Structured logging with run history.", color: "from-accent-cyan to-accent-indigo" },
];

export default function PipelineSection() {
  return (
    <section id="pipeline" className="relative py-32">
      <div className="absolute inset-0 bg-gradient-to-b from-surface via-surface-light/50 to-surface pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <span className="text-xs tracking-widest text-white/30 uppercase mb-4 block">
            The Engine
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Autonomous{" "}
            <span className="text-gradient">Pipeline</span>
          </h2>
          <p className="max-w-xl mx-auto text-white/40 text-sm md:text-base">
            Ten modular stages. One automated flow. From topic ingestion to published video — no human in the loop.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stages.map((stage, i) => (
            <motion.div
              key={stage.num}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="group relative"
            >
              <div className="glass rounded-2xl p-6 h-full hover:bg-white/[0.03] transition-all duration-500 hover:scale-[1.02]">
                <div className="flex items-start justify-between mb-3">
                  <span className={`text-3xl font-display font-bold bg-gradient-to-br ${stage.color} bg-clip-text text-transparent`}>
                    {stage.num}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/30 group-hover:text-accent-teal transition-colors">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
                <h3 className="font-display text-lg font-semibold text-white/90 mb-2">
                  {stage.title}
                </h3>
                <p className="text-sm text-white/40 leading-relaxed">
                  {stage.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
