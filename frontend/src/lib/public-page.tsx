import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageContent } from "@/components/PageContent";
import { routing } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string }> };

export type PageKey = "history" | "tourism" | "achievements" | "services";

// The route of one editable page (see messages "Nav" for its name).
export function createPublicPage(key: PageKey) {
  async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale } = await params;
    if (!hasLocale(routing.locales, locale)) return {};
    const t = await getTranslations({ locale, namespace: "Nav" });
    return { title: `${t(key)} | ${t("brand")}` };
  }

  async function Page({ params }: Props) {
    const { locale } = await params;
    if (!hasLocale(routing.locales, locale)) notFound();
    setRequestLocale(locale);
    return <PageContent pageKey={key} locale={locale} />;
  }

  return { generateMetadata, Page };
}
