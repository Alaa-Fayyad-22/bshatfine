import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";

// Shared by everything under /admin, the login page included (metadata only). The chrome and
// the login guard live in (protected)/layout.tsx; the login page sits outside it.
export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]/admin">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Admin" });
  const tn = await getTranslations({ locale, namespace: "Nav" });
  return {
    title: `${t("title")} | ${tn("brand")}`,
    // The whole admin area stays out of search engines.
    robots: { index: false, follow: false, nocache: true },
  };
}

export default function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  return children;
}
