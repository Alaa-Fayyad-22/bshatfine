import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoginForm } from "@/components/admin/LoginForm";
import { routing } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/login">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Admin.auth" });
  const tn = await getTranslations({ locale, namespace: "Nav" });
  return {
    title: `${t("loginTitle")} | ${tn("brand")}`,
    robots: { index: false, follow: false, nocache: true },
  };
}

// Outside the (protected) group: no guard, no admin chrome.
export default async function AdminLoginPage({ params }: PageProps<"/[locale]/admin/login">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Admin.auth");

  // The form reads ?returnTo=, which is only known per request, so it sits
  // behind <Suspense>.
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
      <LoginForm />
    </Suspense>
  );
}
