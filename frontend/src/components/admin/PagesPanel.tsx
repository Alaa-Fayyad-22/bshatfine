"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { listAdminPages, type AdminPageSummaryDto } from "@/lib/admin-api";
import { toProblem, type Problem } from "@/lib/problem";
import { outlineButton } from "./AdminControls";
import { ProblemNotice } from "./ProblemNotice";

// The four editable pages, created or not, published or not.
export function PagesPanel() {
  const t = useTranslations("Admin.pages");
  const tn = useTranslations("Nav");
  const format = useFormatter();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    attempt: number;
    pages: AdminPageSummaryDto[] | null;
    problem: Problem | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAdminPages().then(
      (pages) => !cancelled && setResult({ attempt, pages, problem: null }),
      (e) => !cancelled && setResult({ attempt, pages: null, problem: toProblem(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const current = result?.attempt === attempt ? result : null;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold md:text-3xl">{t("title")}</h1>
      <p className="mt-2 max-w-prose text-ink/80">{t("intro")}</p>

      <div aria-live="polite" className="empty:hidden">
        {current === null && (
          <p role="status" className="mt-8 text-ink/70">
            {t("loading")}
          </p>
        )}
      </div>

      {current?.problem && (
        <div className="mt-8">
          <ProblemNotice problem={current.problem} onRateDone={() => setAttempt((n) => n + 1)} />
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-3 min-h-11 font-semibold underline underline-offset-4"
          >
            {t("retry")}
          </button>
        </div>
      )}

      {current?.pages && (
        <ul className="mt-8 border-t border-line">
          {current.pages.map((p) => {
            const name = tn(p.key);
            const title = p.arabicTitle ?? p.englishTitle;
            return (
              <li
                key={p.key}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line py-5"
              >
                <div className="min-w-0">
                  <h2 className="text-lg font-bold">{name}</h2>
                  {title && (
                    <p
                      lang={p.arabicTitle ? "ar" : "en"}
                      dir="auto"
                      className="mt-0.5 truncate text-ink/80"
                    >
                      {title}
                    </p>
                  )}
                  <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <span
                        aria-hidden
                        className={`size-2 shrink-0 rounded-full ${
                          !p.exists ? "bg-ink/30" : p.isPublished ? "bg-pine" : "bg-alert-warn"
                        }`}
                      />
                      {!p.exists ? t("notCreated") : p.isPublished ? t("published") : t("draft")}
                    </span>
                    <span className="text-ink/70">
                      {t("colUpdated")}:{" "}
                      {p.updatedAt ? (
                        <time dateTime={p.updatedAt}>
                          {format.dateTime(new Date(p.updatedAt), { dateStyle: "medium" })}
                        </time>
                      ) : (
                        t("never")
                      )}
                    </span>
                  </p>
                </div>
                <Link
                  href={`/admin/pages/${p.key}`}
                  aria-label={p.exists ? t("editLabel", { page: name }) : t("createLabel", { page: name })}
                  className={outlineButton}
                >
                  {p.exists ? t("edit") : t("create")}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
