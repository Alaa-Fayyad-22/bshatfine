import { notFound } from "next/navigation";
import { Suspense } from "react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { NewsTable } from "@/components/admin/NewsTable";
import { NEWS_STATUSES } from "@/lib/admin-api";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// Behind AdminGuard (renders nothing until the session is confirmed).
export const instant = false;

export default async function AdminNewsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/news">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Admin.list");

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold md:text-3xl">{t("title")}</h1>
        <Link
          href="/admin/news/new"
          className="inline-flex min-h-11 items-center rounded-control bg-pine px-5 font-semibold text-paper"
        >
          {t("new")}
        </Link>
      </div>
      {/* ?page=N is request-time data, so the table sits behind <Suspense> */}
      <Suspense fallback={<p role="status" className="mt-8 text-ink/70">{t("loading")}</p>}>
        <Table searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Table({ searchParams }: Pick<PageProps<"/[locale]/admin/news">, "searchParams">) {
  const { page: rawPage, status: rawStatus } = await searchParams;
  const n = Number(Array.isArray(rawPage) ? rawPage[0] : rawPage);
  // ?status=draft works too (the API is case-insensitive); anything unknown means "all".
  const wanted = (Array.isArray(rawStatus) ? rawStatus[0] : rawStatus)?.toLowerCase();
  const status = NEWS_STATUSES.find((s) => s.toLowerCase() === wanted);
  return <NewsTable page={Number.isInteger(n) && n >= 1 ? n : 1} status={status} />;
}
