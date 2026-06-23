"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

export default function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  label,
}: {
  value: number | string;
  prefix?: string;
  suffix?: string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [count, setCount] = useState(0);

  const numericValue = typeof value === "string" ? parseInt(value) || 0 : value;

  useEffect(() => {
    if (!isInView) return;

    let start = 0;
    const duration = 1500;
    const steps = 60;
    const increment = numericValue / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      start += increment;
      if (step >= steps) {
        setCount(numericValue);
        clearInterval(timer);
      } else {
        setCount(Math.round(start));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [isInView, numericValue]);

  return (
    <div ref={ref} className="glass rounded-2xl px-5 py-3 min-w-[130px]">
      <div className="font-display text-2xl font-bold text-gradient">
        {prefix}{count}{suffix}
      </div>
      <div className="text-xs text-white/40 mt-0.5">{label}</div>
    </div>
  );
}
