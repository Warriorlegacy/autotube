"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WaitlistModal({ isOpen, onClose }: WaitlistModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setName("");
        setEmail("");
      } else {
        setError(data.error || "Failed to join waitlist");
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl glass-strong glow-teal p-8 md:p-10 z-10"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
              aria-label="Close modal"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {!success ? (
              <>
                <div className="mb-6 flex justify-center">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-teal to-accent-cyan flex items-center justify-center text-black font-bold text-lg shadow-[0_0_20px_rgba(45,212,191,0.25)]">
                    A
                  </div>
                </div>

                <h3 className="font-display text-2xl md:text-3xl font-bold text-center mb-2">
                  Join the Waitlist
                </h3>
                <p className="text-sm text-white/50 text-center mb-8">
                  Get early access to deploy your autonomous YouTube channel pipeline.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="modal-name" className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                      Full Name
                    </label>
                    <input
                      id="modal-name"
                      type="text"
                      placeholder="Golu Singh"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 rounded-xl border border-white/10 focus:border-accent-teal/50 focus:outline-none text-white/90 text-sm placeholder-white/20 transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="modal-email" className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                      Email Address
                    </label>
                    <input
                      id="modal-email"
                      type="email"
                      required
                      placeholder="golu@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 rounded-xl border border-white/10 focus:border-accent-teal/50 focus:outline-none text-white/90 text-sm placeholder-white/20 transition-all"
                    />
                  </div>

                  {error && (
                    <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-accent-teal to-accent-cyan text-black font-semibold text-sm hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(45,212,191,0.25)] active:scale-[0.98] disabled:scale-100 disabled:opacity-50 disabled:shadow-none transition-all duration-300 flex items-center justify-center gap-2 mt-6"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        Request Access
                        <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
                      </>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="mb-6 flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-success/10 border border-success/30 flex items-center justify-center text-success animate-bounce">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                </div>

                <h3 className="font-display text-2xl md:text-3xl font-bold mb-3">
                  You're on the list!
                </h3>
                <p className="text-sm text-white/50 mb-8 leading-relaxed">
                  Thanks for joining the AutoTube waitlist. We will reach out to you with setup instructions as soon as the next batch of invites is ready.
                </p>

                <button
                  onClick={onClose}
                  className="w-full py-4 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 hover:text-white transition-all duration-300 font-semibold text-sm"
                >
                  Close Window
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
