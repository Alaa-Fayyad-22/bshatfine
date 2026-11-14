import type { Metadata } from "next";
import { Amiri, Cormorant_Garamond, IBM_Plex_Sans_Arabic, Jost } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDirection, routing } from "@/i18n/routing";
import "../globals.css";

// next/font self-hosts the font files (no request to Google, no CSP change) and
// exposes them as CSS variables; globals.css picks the pair for each language.
// English: Cormorant Garamond (headings) and Jost (text), as in the design.
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  display: "swap",
});

// Arabic: Amiri where the design uses the serif, IBM Plex Sans Arabic where it
// uses Jost. Arabic glyphs only, so Latin words keep the two fonts above.
const amiri = Amiri({
  variable: "--font-amiri",
  subsets: ["arabic"],
  weight: ["400", "700"],
  display: "swap",
});

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic"],
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
      className={`${cormorant.variable} ${jost.variable} ${amiri.variable} ${plexArabic.variable}`}
    >
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[60] focus:rounded-control focus:bg-paper focus:px-4 focus:py-3 focus:font-semibold"
          >
            {t("toContent")}
          </a>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
