import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChoosePassword } from "@/components/admin/ChoosePassword";
import { routing } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/choose-password">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Admin.password" });
  const tn = await getTranslations({ locale, namespace: "Nav" });
  return {
    title: `${t("chooseTitle")} | ${tn("brand")}`,
    robots: { index: false, follow: false, nocache: true },
  };
}

// Outside the (protected) group: the admin guard sends people here, so it must
// not wrap this page. The component checks the session itself.
export default async function ChoosePasswordPage({
  params,
}: PageProps<"/[locale]/admin/choose-password">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Admin.auth");

  // The component reads ?returnTo=, known only per request: <Suspense>.
  return (
    <Suspense
      fallback={
        <main id="main" className="grid flex-1 place-items-center p-4 md:p-10">
          <p role="status" className="text-ink/70">
            {t("checking")}
          </p>
        </main>
      }
    >
      <ChoosePassword />
    </Suspense>
  );
}
