import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Reveal } from "@/components/site/Reveal";
import { Toast } from "@/components/site/Toast";
import { UrgentNotices } from "@/components/site/UrgentNotices";
import { routing } from "@/i18n/routing";

// Public-site chrome. Everything inside `.site` follows the approved design
// (see globals.css). The header lies on top of the hero photo that every public
// page starts with. The admin area (../admin) lives outside this route group,
// so it gets none of this.
export default async function SiteLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // next-intl needs this in every layout and page, not only the root layout.
  setRequestLocale(locale);

  return (
    <div className="site">
      {/* Urgent notices, above the header. Renders nothing when there are none. */}
      <UrgentNotices locale={locale} />
      {/* The header is laid over the hero photo (position: absolute); this
          wrapper keeps it below the urgent banner when one is shown. */}
      <div style={{ position: "relative" }}>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </div>
      <Toast />
      <Reveal />
    </div>
  );
}
