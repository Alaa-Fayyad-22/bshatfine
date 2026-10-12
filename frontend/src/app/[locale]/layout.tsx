import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDirection, routing } from "@/i18n/routing";
import { AlertBar } from "@/components/layout/AlertBar";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { ScrollProgress } from "@/components/motion/ScrollProgress";
import "../globals.css";

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

// Tells Next to prebuild /ar and /en at build time.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Meta" });
  return { title: t("title"), description: t("description") };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Lets server components below read the locale without re-reading headers,
  // which keeps the pages statically renderable.
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Skip" });

  return (
    <html
      lang={locale}
      dir={getDirection(locale)}
      className={`${plexArabic.variable} ${plexLatin.variable}`}
    >
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[60] focus:rounded-control focus:bg-ivory focus:px-4 focus:py-3 focus:font-semibold"
          >
            {t("toContent")}
          </a>
          <ScrollProgress />
          <AlertBar />
          {/* Header reads the pathname, which is unknown while prerendering
              dynamic routes such as /news/[id]; reserve its 72px meanwhile. */}
          <Suspense fallback={<div className="h-18" aria-hidden />}>
            <Header />
          </Suspense>
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
