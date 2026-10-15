import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChangePasswordForm } from "@/components/admin/ChangePasswordForm";
import { routing } from "@/i18n/routing";

// Behind AdminGuard (renders nothing until the session is confirmed).
export const instant = false;

export default async function ChangePasswordPage({
  params,
}: PageProps<"/[locale]/admin/account/password">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Admin.password");

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold md:text-3xl">{t("title")}</h1>
      <p className="mt-3 text-ink/80">{t("intro")}</p>
      <div className="mt-6">
        <ChangePasswordForm forced={false} />
      </div>
    </div>
  );
}
