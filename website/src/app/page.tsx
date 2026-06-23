"use client";

import SmoothScroll from "@/components/SmoothScroll";
import Navbar from "@/components/Navbar";
import ScrollProgress from "@/components/ScrollProgress";
import Hero from "@/components/Hero";
import PipelineSection from "@/components/PipelineSection";
import WhyItWins from "@/components/WhyItWins";
import ProductProof from "@/components/ProductProof";
import ComplianceTrust from "@/components/ComplianceTrust";
import ZeroCostScale from "@/components/ZeroCostScale";
import CTA from "@/components/CTA";

export default function Home() {
  return (
    <SmoothScroll>
      <Navbar />
      <ScrollProgress />
      <main>
        <Hero />
        <PipelineSection />
        <WhyItWins />
        <ProductProof />
        <ComplianceTrust />
        <ZeroCostScale />
        <CTA />
      </main>

      <footer className="relative border-t border-white/5 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-accent-teal to-accent-cyan flex items-center justify-center text-black font-bold text-xs">
              A
            </div>
            <span className="text-sm text-white/30">&copy; {new Date().getFullYear()} AutoTube</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="text-xs text-white/20 hover:text-white/50 transition-colors">GitHub</a>
            <a href="#" className="text-xs text-white/20 hover:text-white/50 transition-colors">Documentation</a>
            <a href="#" className="text-xs text-white/20 hover:text-white/50 transition-colors">Privacy</a>
          </div>
          <span className="text-xs text-white/10">
            Built with zero-cost infrastructure. Runs on free tiers.
          </span>
        </div>
      </footer>
    </SmoothScroll>
  );
}
