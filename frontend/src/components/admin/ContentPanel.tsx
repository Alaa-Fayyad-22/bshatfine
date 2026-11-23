"use client";

import { useEffect, useRef, useState } from "react";
import { SiteImage } from "@/components/SiteImage";
import { useTranslations } from "next-intl";
import { ENTRY_KINDS, ENTRY_RULES, isProjectStatus, type EntryKind } from "@/config/entries";
import { Link } from "@/i18n/navigation";
import { listAdminEntries, reorderEntries, type AdminEntryDto } from "@/lib/admin-api";
import { coverUrl } from "@/lib/cover";
import { toProblem, type Problem } from "@/lib/problem";
import { primaryButton } from "./AdminControls";
import { useEntryLabels } from "./entry-labels";
import { isRateLimited, ProblemNotice } from "./ProblemNotice";

// Set by the editor after it deleted an entry (value: its title); the list
// shows the confirmation once.
export const ENTRY_DELETED_FLASH_KEY = "admin-entry-deleted";

const smallButton =
  "inline-flex min-h-11 items-center justify-center rounded-control border px-4 font-medium disabled:cursor-not-allowed disabled:opacity-50";

export const contentHref = (kind: EntryKind) =>
  ({ pathname: "/admin/content", query: { kind } }) as const;

// Arabic title, or the English one when there is no Arabic.
export function entryTitle(e: AdminEntryDto) {
  const ar = e.translations.find((x) => x.language === "ar" && x.title);
  const en = e.translations.find((x) => x.language === "en" && x.title);
  return ar ? { text: ar.title, lang: "ar" } : en ? { text: en.title, lang: "en" } : null;
}

// Admin "Content": one tab per kind (in the URL), each kind's entries in their
// display order with move up/down, and a link to create a new one.
export function ContentPanel({ kind }: { kind: EntryKind }) {
  const t = useTranslations("Admin.content");
  const labels = useEntryLabels();
  const rule = ENTRY_RULES[kind];
  const [attempt, setAttempt] = useState(0);
  const key = `${kind}:${attempt}`;
  const [result, setResult] = useState<{
    key: string;
    entries: AdminEntryDto[] | null;
    problem: Problem | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement | null>(null);
  // After a move, put focus back on the same entry's move button.
  const [focusMove, setFocusMove] = useState<{ id: string; dir: "up" | "down"; n: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAdminEntries(kind).then(
      (entries) => !cancelled && setResult({ key, entries, problem: null }),
      (e) => !cancelled && setResult({ key, entries: null, problem: toProblem(e) }),
    );
    return () => {
      cancelled = true;
    };
    // `key` covers kind and attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // An entry deleted in the editor: say so here, once.
  useEffect(() => {
    try {
      const title = sessionStorage.getItem(ENTRY_DELETED_FLASH_KEY);
      if (title === null) return;
      sessionStorage.removeItem(ENTRY_DELETED_FLASH_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the hand-over from the editor
      setNotice(t("deletedOk", { title: title || t("untitled") }));
    } catch {
      // sessionStorage unavailable: no confirmation message.
    }
    // Runs once on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!focusMove) return;
    const root = listRef.current;
    const pick = (dir: string) =>
      root?.querySelector<HTMLButtonElement>(`[data-move="${focusMove.id}:${dir}"]`);
    const first = pick(focusMove.dir);
    // The button that was pressed is disabled once the entry reaches an end.
    const target = first && !first.disabled ? first : pick(focusMove.dir === "up" ? "down" : "up");
    target?.focus();
  }, [focusMove]);

  const current = result?.key === key ? result : null;
  const entries = current?.entries ?? null;
  const waiting = isRateLimited(problem);

  async function move(index: number, dir: "up" | "down") {
    if (!entries) return;
    const target = dir === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= entries.length) return;
    const reordered = [...entries];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const moved = entries[index];
    setBusy(true);
    setProblem(null);
    setNotice(null);
    try {
      // The API wants EVERY id of this kind in the new order, and answers with the list.
      const list = await reorderEntries(kind, reordered.map((x) => x.id));
      setResult({ key, entries: list, problem: null });
      setNotice(
        t("movedOk", {
          title: entryTitle(moved)?.text ?? t("untitled"),
          position: list.findIndex((x) => x.id === moved.id) + 1,
          total: list.length,
        }),
      );
      setFocusMove((f) => ({ id: moved.id, dir, n: (f?.n ?? 0) + 1 }));
    } catch (e) {
      setProblem(toProblem(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold md:text-3xl">{t("title")}</h1>
        <Link href={{ pathname: "/admin/content/new", query: { kind } }} className={primaryButton}>
          {t(`new.${kind}`)}
        </Link>
      </div>
      <p className="mt-2 max-w-prose text-ink/80">{t("intro")}</p>

      <nav aria-label={t("tabsLabel")} className="mt-6 flex flex-wrap gap-2">
        {ENTRY_KINDS.map((k) => {
          const active = k === kind;
          return (
            <Link
              key={k}
              href={contentHref(k)}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-control border px-4 text-base font-medium ${
                active ? "border-pine bg-pine text-paper" : "border-line bg-paper hover:border-pine"
              }`}
            >
              {t(`kinds.${k}`)}
            </Link>
          );
        })}
      </nav>

      <div aria-live="polite" role="status" className="empty:hidden">
        {notice && (
          <p className="mt-6 border-s-4 border-pine bg-stone px-4 py-3 font-medium text-pine">{notice}</p>
        )}
        {current === null && <p className="mt-8 text-ink/70">{t("loading")}</p>}
      </div>
      {problem && (
        <div className="mt-6">
          <ProblemNotice problem={problem} onRateDone={() => setProblem(null)} />
        </div>
      )}
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

      {entries && entries.length === 0 && (
        <p className="mt-8 max-w-prose text-ink/80">{t("empty", { new: t(`new.${kind}`) })}</p>
      )}

      {entries && entries.length > 0 && (
        <ol
          ref={listRef}
          aria-label={t("listLabel", { kind: t(`kinds.${kind}`) })}
          className="mt-8 border-t border-line"
        >
          {entries.map((e, i) => {
            const title = entryTitle(e);
            const name = title?.text ?? t("untitled");
            const cover = coverUrl(e.coverImageUrl);
            const status = rule.usesStatus && isProjectStatus(e.status) ? e.status : null;
            return (
              <li key={e.id} className="border-b border-line py-5">
                <div className="flex gap-4">
                  <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-card bg-stone">
                    {cover ? (
                      <SiteImage src={cover} alt="" fill sizes="6rem" className="object-cover" />
                    ) : (
                      <span className="absolute inset-0 grid place-items-center px-1 text-center text-xs text-ink/60">
                        {t("noCover")}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-3">
                      <span className="text-sm text-ink/60">{i + 1}</span>
                      <span lang={title?.lang} dir="auto" className="text-lg font-bold break-words">
                        {name}
                      </span>
                    </p>
                    {!e.translations.some((x) => x.language === "ar") && (
                      <p className="text-sm text-ink/80">{t("noArabic")}</p>
                    )}
                    <p className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                      <span className="inline-flex items-center gap-2 font-medium">
                        <span
                          aria-hidden
                          className={`size-2 shrink-0 rounded-full ${e.isPublished ? "bg-pine" : "bg-alert-warn"}`}
                        />
                        {e.isPublished ? t("published") : t("draft")}
                      </span>
                      {rule.usesYear && (
                        <span>
                          <span className="text-ink/70">{labels.yearHeading}: </span>
                          {e.year ?? <span className="text-ink/60">{t("none")}</span>}
                        </span>
                      )}
                      {kind !== "history" && (
                        <span>
                          <span className="text-ink/70">{labels.categoryHeading(kind)}: </span>
                          {e.category ? (
                            labels.category(kind, e.category)
                          ) : (
                            <span className="text-ink/60">{t("none")}</span>
                          )}
                        </span>
                      )}
                      {rule.usesStatus && (
                        <span>
                          <span className="text-ink/70">{labels.statusHeading}: </span>
                          {status ? labels.status(status) : <span className="text-ink/60">{t("none")}</span>}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/admin/content/${e.id}`}
                    aria-label={t("editLabel", { title: name })}
                    className={`${smallButton} border-pine bg-paper text-pine`}
                  >
                    {t("edit")}
                  </Link>
                  <button
                    type="button"
                    data-move={`${e.id}:up`}
                    disabled={busy || waiting || i === 0}
                    aria-label={t("moveUpLabel", { title: name })}
                    onClick={() => move(i, "up")}
                    className={`${smallButton} border-ink/40 bg-paper`}
                  >
                    {t("moveUp")}
                  </button>
                  <button
                    type="button"
                    data-move={`${e.id}:down`}
                    disabled={busy || waiting || i === entries.length - 1}
                    aria-label={t("moveDownLabel", { title: name })}
                    onClick={() => move(i, "down")}
                    className={`${smallButton} border-ink/40 bg-paper`}
                  >
                    {t("moveDown")}
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
