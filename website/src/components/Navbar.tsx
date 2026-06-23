"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = [
  { label: "Pipeline", href: "#pipeline" },
  { label: "Why AutoTube", href: "#why" },
  { label: "Trust", href: "#trust" },
  { label: "Pricing", href: "#scale" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-surface/80 backdrop-blur-xl border-b border-white/5 shadow-2xl shadow-black/20"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        <a href="#" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-teal to-accent-cyan flex items-center justify-center text-black font-bold text-sm group-hover:scale-105 transition-transform">
            A
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">
            utoTube
          </span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-white/50 hover:text-white/90 transition-colors duration-300"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#cta"
            className="text-sm px-5 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-white/90 transition-all duration-300 hover:scale-105"
          >
            Get Started
          </a>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden relative w-6 h-6 flex flex-col justify-center gap-1.5"
          aria-label="Menu"
        >
          <span
            className={`block h-px w-full bg-white/70 transition-transform duration-300 ${
              mobileOpen ? "rotate-45 translate-y-0.5" : ""
            }`}
          />
          <span
            className={`block h-px w-full bg-white/70 transition-opacity duration-300 ${
              mobileOpen ? "opacity-0" : ""
            }`}
          />
          <span
            className={`block h-px w-full bg-white/70 transition-transform duration-300 ${
              mobileOpen ? "-rotate-45 -translate-y-0.5" : ""
            }`}
          />
        </button>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden glass-strong mx-4 mb-4 rounded-2xl overflow-hidden"
          >
            <div className="flex flex-col p-4 gap-2">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="px-4 py-3 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all"
                >
                  {link.label}
                </a>
              ))}
              <a
                href="#cta"
                onClick={() => setMobileOpen(false)}
                className="px-4 py-3 rounded-xl text-sm text-center bg-white/10 hover:bg-white/15 text-white/90 transition-all mt-2"
              >
                Get Started
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
