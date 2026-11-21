import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";

export type MetaPage =
  | "discover"
  | "municipality"
  | "services"
  | "report"
  | "news"
  | "events"
  | "contact"
  | "gallery"
  | "careers";

// The browser-tab title of a public page ("Discover · Bchatfine"), as in the design.
export async function pageMetadata(locale: string, page: MetaPage): Promise<Metadata> {
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Meta" });
  return { title: t(`pages.${page}`) };
}

// "tel:" links want digits and a leading +, without spaces or punctuation.
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
