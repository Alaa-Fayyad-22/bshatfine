"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import {
  listAdminNews,
  NEWS_STATUSES,
  type AdminNewsDto,
  type AdminNewsPage,
  type NewsStatus,
} from "@/lib/admin-api";
import { formatDate, formatNumber } from "@/lib/numbers";
import { toProblem, type Problem } from "@/lib/problem";
import { DELETED_FLASH_KEY, DeleteNewsDialog } from "./DeleteNewsDialog";
import { ProblemNotice } from "./ProblemNotice";
import { StatusText } from "./StatusText";

export const PAGE_SIZE = 20;

// The address of the list for a filter and page. The filter lives in the URL, so
// reload and back/forward keep it; changing it always starts at page 1.
function listHref(status: NewsStatus | undefined, page = 1) {
  const query: Record<string, string> = {};
  if (status) query.status = status;
  if (page > 1) query.page = String(page);
  return Object.keys(query).length === 0
    ? "/admin/news"
    : { pathname: "/admin/news" as const, query };
}

// Arabic title, or the English one when there is no Arabic.
function displayTitle(item: AdminNewsDto) {
  const ar = item.translations.find((x) => x.language === "ar" && x.title);
  const en = item.translations.find((x) => x.language === "en" && x.title);
  return ar ? { text: ar.title, lang: "ar" } : en ? { text: en.title, lang: "en" } : null;
}

export function NewsTable({ page, status }: { page: number; status?: NewsStatus }) {
  const t = useTranslations("Admin.list");
  const ts = useTranslations("Admin.status");
  const locale = useLocale();
  const num = (value: number) => formatNumber(value, locale);
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const key = `${status ?? ""}:${page}:${attempt}`;
  const [result, setResult] = useState<{
    key: string;
    data: AdminNewsPage | null;
    problem: Problem | null;
  } | null>(null);
  // The last page that loaded stays on screen while the next one loads, so the
  // filter links keep their place (and keyboard focus).
  const [shown, setShown] = useState<AdminNewsPage | null>(null);
  const [shownStatus, setShownStatus] = useState<NewsStatus | undefined>(undefined);
  const [deleting, setDeleting] = useState<AdminNewsDto | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeRef = useRef<HTMLDivElement | null>(null);
  const [noticeFocus, setNoticeFocus] = useState(0);

  // Fetch in the browser; a result only counts while its key matches the
  // current filter/page/attempt.
  useEffect(() => {
    let cancelled = false;
    listAdminNews(page, PAGE_SIZE, status).then(
      (data) => {
        if (cancelled) return;
        setResult({ key, data, problem: null });
        setShown(data);
        setShownStatus(status);
      },
      (e) => !cancelled && setResult({ key, data: null, problem: toProblem(e) }),
    );
    return () => {
      cancelled = true;
    };
    // `key` covers page, status and attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // A draft deleted on the edit page: say so here, once.
  useEffect(() => {
    try {
      const title = sessionStorage.getItem(DELETED_FLASH_KEY);
      if (title === null) return;
      sessionStorage.removeItem(DELETED_FLASH_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the hand-over from the edit page
      setNotice(t("deletedOk", { title: title || t("untitled") }));
      setNoticeFocus((n) => n + 1);
    } catch {
      // sessionStorage unavailable: no confirmation message.
    }
    // Runs once on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (noticeFocus > 0) noticeRef.current?.focus();
  }, [noticeFocus]);

  const current = result?.key === key ? result : null;
  const loading = current === null;
  const failed = current !== null && current.data === null;
  const reload = () => setAttempt((n) => n + 1);

  const date = (iso: string | null) =>
    iso ? (
      <time dateTime={iso}>{formatDate(iso, locale, { dateStyle: "medium" })}</time>
    ) : (
      <span className="text-ink/60">{t("notPublished")}</span>
    );

  function afterDelete(item: AdminNewsDto) {
    const title = displayTitle(item)?.text ?? t("untitled");
    setNotice(t("deletedOk", { title }));
    setNoticeFocus((n) => n + 1);
    // Deleting the only row of a later page: that page is gone now, go back one.
    if (shown && shown.items.length === 1 && page > 1) {
      router.replace(listHref(status, page - 1));
    } else {
      reload();
    }
  }

  const filterBar = (
    <nav aria-label={t("filterLabel")} className="mt-4 flex flex-wrap gap-2">
      {[undefined, ...NEWS_STATUSES].map((f) => {
        const active = f === status;
        return (
          <Link
            key={f ?? "All"}
            href={listHref(f)}
            aria-current={active ? "true" : undefined}
            className={`inline-flex min-h-11 items-center rounded-control border px-4 text-base font-medium ${
              active
                ? "border-pine bg-pine text-paper"
                : "border-line bg-paper hover:border-pine"
            }`}
          >
            {f ? ts(f) : t("all")}
          </Link>
        );
      })}
    </nav>
  );

  const noticeRegion = (
    <div
      ref={noticeRef}
      tabIndex={-1}
      aria-live="polite"
      role="status"
      className="outline-none empty:hidden"
    >
      {notice && (
        <p className="mt-4 border-s-4 border-pine bg-stone px-4 py-3 font-medium text-pine">
          {notice}
        </p>
      )}
    </div>
  );

  let body: React.ReactNode;
  if (failed && current?.problem?.kind === "rate") {
    // Too many requests: counts down, then loads again by itself.
    body = (
      <div className="mt-8 max-w-prose">
        <ProblemNotice problem={current.problem} onRateDone={reload} />
      </div>
    );
  } else if (failed) {
    body = (
      <div role="alert" className="mt-8 max-w-prose">
        <p>{t("error")}</p>
        <button
          type="button"
          onClick={reload}
          className="mt-3 min-h-11 font-semibold underline underline-offset-4"
        >
          {t("retry")}
        </button>
      </div>
    );
  } else if (shown === null) {
    body = (
      <p role="status" className="mt-8 text-ink/70">
        {t("loading")}
      </p>
    );
  } else if (page > Math.max(shown.totalPages, 1)) {
    // Asked for a page past the end: say so and point back to page 1.
    body = (
      <div role="status" className="mt-8 max-w-prose">
        <p>{t("pageOutOfRange")}</p>
        <Link
          href={listHref(status)}
          className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
        >
          {t("goToFirst")}
        </Link>
      </div>
    );
  } else {
    const { items, totalCount, totalPages } = shown;
    const hasNext = page < totalPages;
    const hasPrevious = page > 1;
    body = (
      <div aria-busy={loading} className={loading ? "opacity-60" : undefined}>
        <p className="mt-6 text-ink/80">
          {shownStatus
            ? t("totalFiltered", { count: totalCount, n: num(totalCount), status: ts(shownStatus) })
            : t("total", { count: totalCount, n: num(totalCount) })}
          {totalPages === 1 && (
            <>
              {" · "}
              {t("page", { page: num(page), total: num(totalPages) })}
            </>
          )}
        </p>

        {items.length === 0 ? (
          <p role="status" className="mt-8 max-w-prose text-ink/80">
            {shownStatus ? t("emptyFilter") : t("empty")}
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
                {items.map((item) => {
                  const title = displayTitle(item);
                  return (
                    <tr key={item.id} className="border-b border-line">
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
                        {/* Only drafts can be deleted; published and archived news can only be archived. */}
                        {item.status === "Draft" && (
                          <button
                            type="button"
                            onClick={() => {
                              setNotice(null);
                              setDeleting(item);
                            }}
                            aria-label={t("deleteLabel", { title: title?.text ?? t("untitled") })}
                            className="ms-4 inline-flex min-h-11 items-center font-semibold text-alert-danger underline underline-offset-4"
                          >
                            {t("delete")}
                          </button>
                        )}
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
                href={listHref(status, page - 1)}
                rel="prev"
                className="inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline"
              >
                {t("previous")}
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm text-ink/70">{t("page", { page: num(page), total: num(totalPages) })}</span>
            {hasNext ? (
              <Link
                href={listHref(status, page + 1)}
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
      </div>
    );
  }

  const deletingTitle = deleting ? displayTitle(deleting) : null;

  return (
    <>
      {noticeRegion}
      {filterBar}
      {body}
      {deleting && (
        <DeleteNewsDialog
          id={deleting.id}
          title={deletingTitle?.text ?? t("untitled")}
          lang={deletingTitle?.lang}
          onClose={() => setDeleting(null)}
          onDeleted={() => afterDelete(deleting)}
        />
      )}
    </>
  );
}
