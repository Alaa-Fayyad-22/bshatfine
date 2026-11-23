"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { isEventCategory } from "@/config/events";
import { Link } from "@/i18n/navigation";
import { listAdminEvents, type AdminEventDto, type Paged } from "@/lib/admin-api";
import { formatEventWhen } from "@/lib/event-time";
import { formatNumber } from "@/lib/numbers";
import { toProblem, type Problem } from "@/lib/problem";
import { ProblemNotice } from "./ProblemNotice";

const PAGE_SIZE = 20;

// Set by the editor after it deleted an event (value: its title); the list
// shows the confirmation once.
export const EVENT_DELETED_FLASH_KEY = "admin-event-deleted";

const listHref = (page: number) =>
  page > 1 ? { pathname: "/admin/events" as const, query: { page: String(page) } } : "/admin/events";

// Arabic title, or the English one when there is no Arabic.
export function eventTitle(e: AdminEventDto) {
  const ar = e.translations.find((x) => x.language === "ar" && x.title);
  const en = e.translations.find((x) => x.language === "en" && x.title);
  return ar ? { text: ar.title, lang: "ar" } : en ? { text: en.title, lang: "en" } : null;
}

// Admin "Events": every event (published or not), newest start first, paged.
export function EventsTable({ page }: { page: number }) {
  const t = useTranslations("Admin.events");
  const tc = useTranslations("Events.categories");
  const locale = useLocale();
  const num = (value: number) => formatNumber(value, locale);
  const [attempt, setAttempt] = useState(0);
  const key = `${page}:${attempt}`;
  const [result, setResult] = useState<{
    key: string;
    data: Paged<AdminEventDto> | null;
    problem: Problem | null;
  } | null>(null);
  const [shown, setShown] = useState<Paged<AdminEventDto> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeRef = useRef<HTMLDivElement | null>(null);
  // "Upcoming" / "Past" is decided against the time the list was loaded.
  const [now, setNow] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listAdminEvents(page, PAGE_SIZE).then(
      (data) => {
        if (cancelled) return;
        setNow(Date.now());
        setResult({ key, data, problem: null });
        setShown(data);
      },
      (e) => !cancelled && setResult({ key, data: null, problem: toProblem(e) }),
    );
    return () => {
      cancelled = true;
    };
    // `key` covers page and attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // An event deleted in the editor: say so here, once.
  useEffect(() => {
    try {
      const title = sessionStorage.getItem(EVENT_DELETED_FLASH_KEY);
      if (title === null) return;
      sessionStorage.removeItem(EVENT_DELETED_FLASH_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the hand-over from the editor
      setNotice(t("deletedOk", { title: title || t("untitled") }));
      setTimeout(() => noticeRef.current?.focus(), 0);
    } catch {
      // sessionStorage unavailable: no confirmation message.
    }
    // Runs once on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = result?.key === key ? result : null;
  const loading = current === null;
  const failed = current !== null && current.data === null;
  const reload = () => setAttempt((n) => n + 1);

  let body: React.ReactNode;
  if (failed && current?.problem?.kind === "rate") {
    body = (
      <div className="mt-8 max-w-prose">
        <ProblemNotice problem={current.problem} onRateDone={reload} />
      </div>
    );
  } else if (failed) {
    body = (
      <div role="alert" className="mt-8 max-w-prose">
        <p>{t("error")}</p>
        <button type="button" onClick={reload} className="mt-3 min-h-11 font-semibold underline underline-offset-4">
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
    body = (
      <div role="status" className="mt-8 max-w-prose">
        <p>{t("pageOutOfRange")}</p>
        <Link
          href={listHref(1)}
          className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
        >
          {t("goToFirst")}
        </Link>
      </div>
    );
  } else {
    const { items, totalCount, totalPages } = shown;
    body = (
      <div aria-busy={loading} className={loading ? "opacity-60" : undefined}>
        <p className="mt-6 text-ink/80">
          {t("total", { count: totalCount, n: num(totalCount) })}
          {totalPages > 1 && ` · ${t("page", { page: num(page), total: num(totalPages) })}`}
        </p>

        {items.length === 0 ? (
          <p role="status" className="mt-8 max-w-prose text-ink/80">
            {t("empty")}
          </p>
        ) : (
          <div className="relative mt-6 overflow-x-auto">
            <table className="w-full min-w-[44rem] border-collapse text-start text-base">
              <thead>
                <tr className="border-b border-ink/30 text-sm text-ink/70">
                  <th scope="col" className="py-3 pe-4 text-start font-medium">{t("colTitle")}</th>
                  <th scope="col" className="py-3 pe-4 text-start font-medium">{t("colDate")}</th>
                  <th scope="col" className="py-3 pe-4 text-start font-medium">{t("colCategory")}</th>
                  <th scope="col" className="py-3 pe-4 text-start font-medium">{t("colStatus")}</th>
                  <th scope="col" className="py-3 pe-4 text-start font-medium">{t("colWhen")}</th>
                  <th scope="col" className="py-3 text-start font-medium">
                    <span className="sr-only">{t("colActions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => {
                  const title = eventTitle(e);
                  const name = title?.text ?? t("untitled");
                  const past = new Date(e.finishesAt).getTime() < now;
                  return (
                    <tr key={e.id} className="border-b border-line">
                      <td className="max-w-80 py-3 pe-4 font-medium">
                        <span lang={title?.lang} dir="auto" className="line-clamp-2 break-words">
                          {name}
                        </span>
                      </td>
                      <td className="py-3 pe-4">
                        <time dateTime={e.startsAt}>{formatEventWhen(locale, e)}</time>
                      </td>
                      <td className="py-3 pe-4 whitespace-nowrap">
                        {isEventCategory(e.category) ? tc(e.category) : e.category}
                      </td>
                      <td className="py-3 pe-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-2 font-medium">
                          <span
                            aria-hidden
                            className={`size-2 shrink-0 rounded-full ${e.isPublished ? "bg-pine" : "bg-alert-warn"}`}
                          />
                          {e.isPublished ? t("published") : t("unpublished")}
                        </span>
                      </td>
                      <td className="py-3 pe-4 whitespace-nowrap">
                        <span
                          className={`inline-block rounded-control border px-2 py-0.5 text-sm ${
                            past ? "border-ink/30 text-ink/70" : "border-pine text-pine"
                          }`}
                        >
                          {past ? t("past") : t("upcoming")}
                        </span>
                      </td>
                      <td className="py-3 whitespace-nowrap">
                        <Link
                          href={`/admin/events/${e.id}`}
                          aria-label={t("editLabel", { title: name })}
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
          <nav aria-label={t("pagination")} className="mt-8 flex items-center justify-between gap-6">
            {page > 1 ? (
              <Link
                href={listHref(page - 1)}
                rel="prev"
                className="inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline"
              >
                {t("previous")}
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm text-ink/70">{t("page", { page: num(page), total: num(totalPages) })}</span>
            {page < totalPages ? (
              <Link
                href={listHref(page + 1)}
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

  return (
    <>
      <div ref={noticeRef} tabIndex={-1} aria-live="polite" role="status" className="outline-none empty:hidden">
        {notice && (
          <p className="mt-4 border-s-4 border-pine bg-stone px-4 py-3 font-medium text-pine">{notice}</p>
        )}
      </div>
      {body}
    </>
  );
}
