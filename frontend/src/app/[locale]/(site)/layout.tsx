import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { AlertBar } from "@/components/layout/AlertBar";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { ScrollProgress } from "@/components/motion/ScrollProgress";
import { routing } from "@/i18n/routing";

// Public-site chrome. The admin area (../admin) lives outside this route group
// so it does not get the public header, alert bar or footer.
export default async function SiteLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // next-intl needs this in every layout and page, not only the root layout.
  setRequestLocale(locale);

  return (
    <>
      <ScrollProgress />
      <AlertBar />
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
