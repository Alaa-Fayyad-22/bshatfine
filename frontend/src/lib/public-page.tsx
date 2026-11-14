import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { PageContent, type EditablePageKey } from "@/components/PageContent";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/site-meta";

type Props = { params: Promise<{ locale: string }> };

// The route of one editable page shown on its own address (tourism,
// achievements). The "history" page is shown on /discover instead.
export function createPublicPage(key: EditablePageKey) {
  async function generateMetadata({ params }: Props): Promise<Metadata> {
    return pageMetadata((await params).locale, key);
  }

  async function Page({ params }: Props) {
    const { locale } = await params;
    if (!hasLocale(routing.locales, locale)) notFound();
    setRequestLocale(locale);
    return <PageContent pageKey={key} locale={locale} />;
  }

  return { generateMetadata, Page };
}
