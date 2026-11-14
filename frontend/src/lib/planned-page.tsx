import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { ComingSoon } from "@/components/ComingSoon";
import { showPlanned, type PlannedNavKey } from "@/config/navigation";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/site-meta";

type Props = { params: Promise<{ locale: string }> };

// One "coming soon" route per planned navigation item. In production (unless
// NEXT_PUBLIC_SHOW_PLANNED_NAV=true) the route is a real 404.
export function createPlannedPage(section: PlannedNavKey) {
  async function generateMetadata({ params }: Props): Promise<Metadata> {
    if (!showPlanned) return {};
    return pageMetadata((await params).locale, section);
  }

  async function Page({ params }: Props) {
    // Before any await, so the 404 status is sent (see proxy.ts for why).
    if (!showPlanned) notFound();
    const { locale } = await params;
    if (!hasLocale(routing.locales, locale)) notFound();
    setRequestLocale(locale);
    return <ComingSoon section={section} />;
  }

  return { generateMetadata, Page };
}
