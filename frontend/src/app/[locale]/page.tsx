import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";

// Temporary Phase 2 check. Replaced by the real homepage in Phase 4.
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("Meta");

  return (
    <div className="section-y">
      <div className="page-container">
        <h1 className="text-4xl font-bold md:text-5xl">{t("title")}</h1>
        <p className="mt-4">{t("description")}</p>
      </div>
    </div>
  );
}
