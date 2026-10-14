"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { listAdminNews, type AdminNewsDto, type AdminNewsPage, type NewsStatus } from "@/lib/admin-api";
import { StatusText } from "./StatusText";

export const PAGE_SIZE = 20;

const filters = ["All", "Draft", "Published", "Archived"] as const;
type Filter = (typeof filters)[number];

// Arabic title, or the English one when there is no Arabic.
function displayTitle(item: AdminNewsDto) {
  const ar = item.translations.find((x) => x.language === "ar" && x.title);
  const en = item.translations.find((x) => x.language === "en" && x.title);
  return ar ? { text: ar.title, lang: "ar" } : en ? { text: en.title, lang: "en" } : null;
}

export function NewsTable({ page }: { page: number }) {
  const t = useTranslations("Admin.list");
  const ts = useTranslations("Admin.status");
  const format = useFormatter();
  const [filter, setFilter] = useState<Filter>("All");
  const [attempt, setAttempt] = useState(0);
  const key = `${page}:${attempt}`;
  const [result, setResult] = useState<{
    key: string;
    data: AdminNewsPage | null;
  } | null>(null);

  // Fetch in the browser; a result only counts while its key matches the
  // current page/attempt, so changing page shows the loading state again.
  useEffect(() => {
    let cancelled = false;
    listAdminNews(page, PAGE_SIZE).then(
      (data) => !cancelled && setResult({ key, data }),
      () => !cancelled && setResult({ key, data: null }),
    );
    return () => {
      cancelled = true;
    };
  }, [page, key]);

  const current = result?.key === key ? result : null;
  const data = current?.data ?? null;
  const failed = current !== null && current.data === null;
  const load = () => setAttempt((n) => n + 1);

  const date = (iso: string | null) =>
    iso ? (
      <time dateTime={iso}>{format.dateTime(new Date(iso), { dateStyle: "medium" })}</time>
    ) : (
      <span className="text-ink/60">{t("notPublished")}</span>
    );

  if (failed) {
    return (
      <div role="alert" className="mt-8 max-w-prose">
        <p>{t("error")}</p>
        <button
          type="button"
          onClick={load}
          className="mt-3 min-h-11 font-semibold underline underline-offset-4"
        >
          {t("retry")}
        </button>
      </div>
    );
  }
  if (data === null) {
    return (
      <p role="status" className="mt-8 text-ink/70">
        {t("loading")}
      </p>
    );
  }

  const { items, totalCount, totalPages } = data;

  // Asked for a page past the end: say so and point back to page 1.
  if (page > Math.max(totalPages, 1)) {
    return (
      <div role="status" className="mt-8 max-w-prose">
        <p>{t("pageOutOfRange")}</p>
        <Link
          href="/admin/news"
          className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
        >
          {t("goToFirst")}
        </Link>
      </div>
    );
  }

  const visible =
    filter === "All" ? items : items.filter((i) => i.status === (filter as NewsStatus));
  const hasNext = page < totalPages;
  const hasPrevious = page > 1;

  return (
    <>
      <p className="mt-6 text-ink/80">{t("total", { count: totalCount })}</p>
      <div role="group" aria-label={t("filterLabel")} className="mt-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`min-h-11 rounded-control border px-4 text-base font-medium ${
              filter === f
                ? "border-cedar bg-cedar text-ivory"
                : "border-hairline bg-ivory hover:border-cedar"
            }`}
          >
            {f === "All" ? t("all") : ts(f)}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p role="status" className="mt-8 max-w-prose text-ink/80">
          {items.length === 0 ? t("empty") : t("emptyFilter")}
        </p>
      ) : (
        <div className="relative mt-6 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-start text-base">
            <thead>
              <tr className="border-b border-ink/30 text-sm text-ink/70">
                <th scope="col" className="py-3 pe-4 text-start font-medium">{t("colTitle")}</th>
                <th scope="col" className="py-3 pe-4 text-start font-medium">{t("colStatus")}</th>
                <th scope="col" className="py-3 pe-4 text-start font-medium">{t("colCreated")}</th>
                <th scope="col" className="py-3 pe-4 text-start font-medium">{t("colPublished")}</th>
                <th scope="col" className="py-3 text-start font-medium">
                  <span className="sr-only">{t("colActions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const title = displayTitle(item);
                return (
                  <tr key={item.id} className="border-b border-hairline">
                    <td className="max-w-80 py-3 pe-4 font-medium">
                      <span lang={title?.lang} className="line-clamp-2">
                        {title?.text ?? t("untitled")}
                      </span>
                    </td>
                    <td className="py-3 pe-4 whitespace-nowrap">
                      <StatusText status={item.status} />
                    </td>
                    <td className="py-3 pe-4 whitespace-nowrap">{date(item.createdAt)}</td>
                    <td className="py-3 pe-4 whitespace-nowrap">{date(item.publishedAt)}</td>
                    <td className="py-3 whitespace-nowrap">
                      <Link
                        href={`/admin/news/${item.id}`}
                        aria-label={t("editLabel", { title: title?.text ?? t("untitled") })}
                        className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
                      >
                        {t("edit")}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav
          aria-label={t("pagination")}
          className="mt-8 flex items-center justify-between gap-6"
        >
          {hasPrevious ? (
            <Link
              href={
                page - 1 === 1
                  ? "/admin/news"
                  : { pathname: "/admin/news", query: { page: page - 1 } }
              }
              rel="prev"
              className="inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline"
            >
              {t("previous")}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-ink/70">{t("page", { page, total: totalPages })}</span>
          {hasNext ? (
            <Link
              href={{ pathname: "/admin/news", query: { page: page + 1 } }}
              rel="next"
              className="inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline"
            >
              {t("next")}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
