"use client";

import { ReactNode, useEffect } from "react";
import Lenis from "lenis";

export default function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      smoothWheel: true,
    });

    function onFrame(time: number) {
      lenis.raf(time);
      requestAnimationFrame(onFrame);
    }
    requestAnimationFrame(onFrame);

    return () => {
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
