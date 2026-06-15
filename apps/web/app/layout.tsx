import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { ThemeWatcher } from "@/components/ThemeWatcher";
import { AuthProvider } from "@/lib/auth";

// Fraunces (display) + Instrument Sans (body) are above-the-fold on every page,
// so they preload. IBM Plex Mono is only small labels/kickers/citations — never
// the LCP element — so we skip its preload to keep the critical font fetches lean
// (it still loads on demand, swapping in via font-display: swap).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  display: "swap",
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "entri — today",
  description:
    "Your own notes, taken seriously. Daily review tuned to your exam date.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Runs before paint: restores the saved theme so there is no flash.
const themeInit = `(function(){try{document.documentElement.classList.add("js");var t=localStorage.getItem("entri-theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.setAttribute("data-theme","dark")}}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${instrument.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <ThemeWatcher />
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
