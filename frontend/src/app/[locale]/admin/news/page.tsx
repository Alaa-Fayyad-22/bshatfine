import { notFound } from "next/navigation";
import { Suspense } from "react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { NewsTable } from "@/components/admin/NewsTable";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

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
          className="inline-flex min-h-11 items-center rounded-control bg-cedar px-5 font-semibold text-ivory"
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
  const raw = (await searchParams).page;
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return <NewsTable page={Number.isInteger(n) && n >= 1 ? n : 1} />;
}
