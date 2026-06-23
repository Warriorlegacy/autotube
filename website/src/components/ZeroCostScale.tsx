"use client";

import { motion } from "framer-motion";

const services = [
  { name: "Gemini Flash", use: "Script & metadata generation", tier: "Free tier", color: "from-blue-400 to-cyan-400" },
  { name: "Groq", use: "LLM fallback inference", tier: "Free tier", color: "from-orange-400 to-red-400" },
  { name: "Edge-TTS", use: "Voice narration synthesis", tier: "Free (local)", color: "from-green-400 to-teal-400" },
  { name: "Pexels", use: "Stock video footage", tier: "Free tier", color: "from-rose-400 to-pink-400" },
  { name: "Pixabay", use: "Media fallback", tier: "Free tier", color: "from-amber-400 to-yellow-400" },
  { name: "Supabase", use: "State & queue management", tier: "Free tier", color: "from-emerald-400 to-green-400" },
  { name: "GitHub Actions", use: "Scheduled pipeline execution", tier: "Free (2,000 min/mo)", color: "from-gray-400 to-slate-400" },
  { name: "YouTube API", use: "Upload & metadata", tier: "Free (10,000 units/day)", color: "from-red-400 to-rose-400" },
];

export default function ZeroCostScale() {
  return (
    <section id="scale" className="relative py-32">
      <div className="absolute inset-0 bg-gradient-to-b from-surface via-surface-light/30 to-surface pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-xs tracking-widest text-white/30 uppercase mb-4 block">
            Zero-Cost Scale
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Enterprise-Grade.<br />
            <span className="text-gradient">Free to Operate.</span>
          </h2>
          <p className="max-w-xl mx-auto text-white/40 text-sm md:text-base">
            AutoTube runs entirely on free-tier services. No monthly bills. No hidden costs. Just smart architecture.
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          <div className="glass rounded-3xl p-8 md:p-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {services.map((svc, i) => (
                <motion.div
                  key={svc.name}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  className="flex items-start gap-4 p-4 rounded-xl hover:bg-white/[0.03] transition-colors"
                >
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 bg-gradient-to-br ${svc.color}`} />
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-display text-sm font-semibold text-white/90">
                        {svc.name}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/30">
                        {svc.tier}
                      </span>
                    </div>
                    <p className="text-xs text-white/40">{svc.use}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-white/5 text-center">
              <span className="text-xs text-white/30">
                Total monthly cost: <strong className="text-success">$0.00</strong> — Full autonomous publishing, zero infrastructure spend
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
