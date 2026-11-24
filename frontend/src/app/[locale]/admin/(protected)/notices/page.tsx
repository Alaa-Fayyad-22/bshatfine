import { notFound } from "next/navigation";
import { Suspense } from "react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { primaryButton } from "@/components/admin/AdminControls";
import { NoticesTable } from "@/components/admin/NoticesTable";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// Behind AdminGuard (renders nothing until the session is confirmed).
export const instant = false;

export default async function AdminNoticesPage({ params, searchParams }: PageProps<"/[locale]/admin/notices">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Admin.notices");

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold md:text-3xl">{t("title")}</h1>
        <Link href="/admin/notices/new" className={primaryButton}>
          {t("new")}
        </Link>
      </div>
      <p className="mt-2 max-w-prose text-ink/80">{t("intro")}</p>
      {/* ?page=N is request-time data, so the table sits behind <Suspense> */}
      <Suspense fallback={<p role="status" className="mt-8 text-ink/70">{t("loading")}</p>}>
        <Table searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Table({ searchParams }: Pick<PageProps<"/[locale]/admin/notices">, "searchParams">) {
  const { page: raw } = await searchParams;
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return <NoticesTable page={Number.isInteger(n) && n >= 1 ? n : 1} />;
}
