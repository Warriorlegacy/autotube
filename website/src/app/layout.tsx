import type { Metadata } from "next";
import localFont from "next/font/local";
import { Inter } from "next/font/google";
import "./globals.css";

const display = localFont({
  src: [
    { path: "../../public/fonts/ClashDisplay-Regular.woff2", weight: "400" },
    { path: "../../public/fonts/ClashDisplay-Medium.woff2", weight: "500" },
    { path: "../../public/fonts/ClashDisplay-Semibold.woff2", weight: "600" },
    { path: "../../public/fonts/ClashDisplay-Bold.woff2", weight: "700" },
  ],
  variable: "--font-display",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AutoTube — Your YouTube Channel. Running Itself.",
  description:
    "AutoTube is an autonomous AI-powered YouTube publishing engine. Source topics, write scripts, generate voice-over, assemble videos, create thumbnails, and upload on autopilot.",
  icons: {
    icon: [
      {
        url: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="%232dd4bf"/><text x="16" y="22" text-anchor="middle" font-family="system-ui" font-weight="800" font-size="18" fill="black">A</text></svg>',
        type: "image/svg+xml",
      },
    ],
  },
  openGraph: {
    title: "AutoTube — Autonomous YouTube Publishing Engine",
    description:
      "From topic to published video — on autopilot. Zero-cost, fully autonomous pipeline.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="font-body bg-surface text-white/90">{children}</body>
    </html>
  );
}
