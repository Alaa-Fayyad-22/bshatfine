import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminNav } from "@/components/admin/AdminNav";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

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

// Admin chrome: a calm sidebar, separate from the public header and footer.
// No scroll animations here on purpose.
export default async function AdminLayout({
  children,
  params,
}: LayoutProps<"/[locale]/admin">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Admin");
  const tn = await getTranslations("Nav");

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="border-b border-hairline bg-sand p-4 md:w-60 md:shrink-0 md:border-e md:border-b-0 md:p-6">
        <div className="flex flex-col gap-4 md:sticky md:top-6 md:gap-8">
          <p className="text-lg font-bold">
            {tn("brand")}
            <span className="block text-sm font-medium text-ink/70">{t("brand")}</span>
          </p>
          <AdminNav />
          <div className="flex items-center justify-between gap-4 text-base md:mt-8 md:flex-col md:items-start md:gap-1">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center underline underline-offset-4"
            >
              {t("backToSite")}
            </Link>
            <LocaleSwitcher />
          </div>
        </div>
      </aside>
      <main id="main" className="min-w-0 flex-1 p-4 md:p-10">
        {children}
      </main>
    </div>
  );
}
