import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";

// next/font self-hosts the font files and exposes them as CSS variables,
// which globals.css then uses depending on the page language.
const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexLatin = IBM_Plex_Sans({
  variable: "--font-plex-latin",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "بلدية بشتفين",
  description: "الموقع الرسمي لبلدية بشتفين في الشوف",
};

// Temporary: Phase 2 moves <html> into app/[locale]/layout.tsx so that
// lang and dir can change per locale.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${plexArabic.variable} ${plexLatin.variable}`}
    >
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
