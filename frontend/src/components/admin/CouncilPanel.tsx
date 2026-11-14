"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  activateCouncilMember,
  deactivateCouncilMember,
  deleteCouncilMember,
  listCouncil,
  reorderCouncil,
  type AdminCouncilMemberDto,
} from "@/lib/admin-api";
import { coverUrl } from "@/lib/cover";
import { toProblem, type Problem } from "@/lib/problem";
import { dangerButton, neutralButton, primaryButton } from "./AdminControls";
import { CouncilMemberDialog, initials } from "./CouncilMemberDialog";
import { Modal, useModalClose } from "./Modal";
import { isRateLimited, ProblemNotice } from "./ProblemNotice";

const smallButton =
  "inline-flex min-h-11 items-center justify-center rounded-control border px-4 font-medium disabled:cursor-not-allowed disabled:opacity-50";

// Admin list of the council: display order, status, and every action.
export function CouncilPanel() {
  const t = useTranslations("Admin.council");
  const [attempt, setAttempt] = useState(0);
  const [members, setMembers] = useState<AdminCouncilMemberDto[] | null>(null);
  const [loadProblem, setLoadProblem] = useState<Problem | null>(null);
  // Which dialog is open: "add", a member id (edit), or none.
  const [dialog, setDialog] = useState<"add" | string | null>(null);
  const [deleting, setDeleting] = useState<AdminCouncilMemberDto | null>(null);
  const [busyId, setBusyId] = useState<string | "order" | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  // After a move, put focus back on the same member's move button.
  const [focusMove, setFocusMove] = useState<{ id: string; dir: "up" | "down"; n: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCouncil().then(
      (list) => {
        if (cancelled) return;
        setMembers(list);
        setLoadProblem(null);
      },
      (e) => !cancelled && setLoadProblem(toProblem(e)),
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    if (!focusMove) return;
    const root = listRef.current;
    const pick = (dir: string) =>
      root?.querySelector<HTMLButtonElement>(`[data-move="${focusMove.id}:${dir}"]`);
    const first = pick(focusMove.dir);
    // The button that was pressed is disabled once the member reaches an end.
    const target = first && !first.disabled ? first : pick(focusMove.dir === "up" ? "down" : "up");
    target?.focus();
  }, [focusMove]);

  const upsert = (m: AdminCouncilMemberDto) =>
    setMembers((list) =>
      list ? (list.some((x) => x.id === m.id) ? list.map((x) => (x.id === m.id ? m : x)) : [...list, m]) : [m],
    );

  async function act(id: string | "order", action: () => Promise<void>) {
    setBusyId(id);
    setProblem(null);
    setNotice(null);
    try {
      await action();
    } catch (e) {
      setProblem(toProblem(e));
    } finally {
      setBusyId(null);
    }
  }

  function move(index: number, dir: "up" | "down") {
    if (!members) return;
    const target = dir === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= members.length) return;
    const reordered = [...members];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const m = members[index];
    return act("order", async () => {
      // The API wants EVERY id in the new order, and answers with the new list.
      setMembers(await reorderCouncil(reordered.map((x) => x.id)));
      setNotice(t("movedOk", { name: m.nameAr, position: target + 1, total: reordered.length }));
      setFocusMove((f) => ({ id: m.id, dir, n: (f?.n ?? 0) + 1 }));
    });
  }

  function toggle(m: AdminCouncilMemberDto) {
    return act(m.id, async () => {
      upsert(m.isActive ? await deactivateCouncilMember(m.id) : await activateCouncilMember(m.id));
      setNotice(t(m.isActive ? "deactivatedOk" : "activatedOk", { name: m.nameAr }));
    });
  }

  const editing = typeof dialog === "string" && dialog !== "add" ? members?.find((m) => m.id === dialog) : undefined;

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold md:text-3xl">{t("title")}</h1>
        <button type="button" onClick={() => setDialog("add")} className={primaryButton}>
          {t("add")}
        </button>
      </div>
      <p className="mt-2 max-w-prose text-ink/80">{t("intro")}</p>

      <div aria-live="polite" role="status" className="empty:hidden">
        {notice && <p className="mt-6 font-medium text-pine">{notice}</p>}
        {members === null && !loadProblem && <p className="mt-8 text-ink/70">{t("loading")}</p>}
      </div>
      {problem && (
        <div className="mt-6">
          <ProblemNotice problem={problem} onRateDone={() => setProblem(null)} />
        </div>
      )}
      {loadProblem && (
        <div className="mt-8">
          <ProblemNotice problem={loadProblem} onRateDone={() => setAttempt((n) => n + 1)} />
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-3 min-h-11 font-semibold underline underline-offset-4"
          >
            {t("retry")}
          </button>
        </div>
      )}

      {members && members.length === 0 && <p className="mt-8 text-ink/80">{t("empty")}</p>}

      {members && members.length > 0 && (
        <ul ref={listRef} aria-label={t("listLabel")} className="mt-8 border-t border-line">
          {members.map((m, i) => {
            const busy = busyId !== null;
            const waiting = isRateLimited(problem);
            const photo = coverUrl(m.photoUrl);
            return (
              <li key={m.id} className="border-b border-line py-5">
                <div className="flex gap-4">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-card bg-stone">
                    {photo ? (
                      <Image src={photo} alt="" fill sizes="4rem" className="object-cover" />
                    ) : (
                      <span aria-hidden className="absolute inset-0 grid place-items-center text-lg font-semibold text-pine/60">
                        {initials(m.nameAr)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-3">
                      <span className="text-sm text-ink/60">{i + 1}</span>
                      <span lang="ar" dir="rtl" className="text-lg font-bold break-words">
                        {m.nameAr}
                      </span>
                    </p>
                    <p lang="ar" dir="rtl" className="text-ink/80">
                      {m.positionAr}
                    </p>
                    <p lang="en" dir="ltr" className="mt-1 text-sm text-ink/70 text-start">
                      {m.nameEn ? `${m.nameEn} · ${m.positionEn ?? ""}` : <span className="text-ink/60">{t("noEnglish")}</span>}
                    </p>
                    <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium">
                      <span aria-hidden className={`size-2 shrink-0 rounded-full ${m.isActive ? "bg-pine" : "bg-ink/30"}`} />
                      {m.isActive ? t("active") : t("inactive")}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={t("editLabel", { name: m.nameAr })}
                    onClick={() => setDialog(m.id)}
                    className={`${smallButton} border-pine bg-paper text-pine`}
                  >
                    {t("edit")}
                  </button>
                  <button
                    type="button"
                    data-move={`${m.id}:up`}
                    disabled={busy || waiting || i === 0}
                    aria-label={t("moveUpLabel", { name: m.nameAr })}
                    onClick={() => move(i, "up")}
                    className={`${smallButton} border-ink/40 bg-paper`}
                  >
                    {t("moveUp")}
                  </button>
                  <button
                    type="button"
                    data-move={`${m.id}:down`}
                    disabled={busy || waiting || i === members.length - 1}
                    aria-label={t("moveDownLabel", { name: m.nameAr })}
                    onClick={() => move(i, "down")}
                    className={`${smallButton} border-ink/40 bg-paper`}
                  >
                    {t("moveDown")}
                  </button>
                  <button
                    type="button"
                    disabled={busy || waiting}
                    aria-label={t(m.isActive ? "deactivateLabel" : "activateLabel", { name: m.nameAr })}
                    onClick={() => toggle(m)}
                    className={`${smallButton} border-ink/40 bg-paper`}
                  >
                    {m.isActive ? t("deactivate") : t("activate")}
                  </button>
                  <button
                    type="button"
                    disabled={busy || waiting}
                    aria-label={t("deleteLabel", { name: m.nameAr })}
                    onClick={() => setDeleting(m)}
                    className={`${smallButton} border-alert-danger bg-paper text-alert-danger`}
                  >
                    {t("delete")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(dialog === "add" || editing) && (
        <CouncilMemberDialog
          key="member-dialog"
          initial={editing ?? null}
          onChange={(m) => {
            upsert(m);
            // After adding, the dialog continues as the edit dialog of that member.
            setDialog((d) => (d === "add" ? m.id : d));
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {deleting && (
        <DeleteMemberDialog
          member={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setMembers((list) => list?.filter((x) => x.id !== deleting.id) ?? null);
            setNotice(t("deletedOk", { name: deleting.nameAr }));
          }}
        />
      )}
    </div>
  );
}

function DeleteMemberDialog({
  member,
  onClose,
  onDeleted,
}: {
  member: AdminCouncilMemberDto;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("Admin.council");
  return (
    <Modal title={t("deleteTitle")} onClose={onClose}>
      <DeleteBody member={member} onDeleted={onDeleted} />
    </Modal>
  );
}

function DeleteBody({
  member,
  onDeleted,
}: {
  member: AdminCouncilMemberDto;
  onDeleted: () => void;
}) {
  const t = useTranslations("Admin.council");
  const close = useModalClose();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const sending = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Start on the harmless button (the dialog opens after this effect runs).
  useEffect(() => {
    const timer = setTimeout(() => cancelRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, []);

  async function confirm() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setProblem(null);
    try {
      await deleteCouncilMember(member.id);
    } catch (e) {
      setProblem(toProblem(e));
      sending.current = false;
      setBusy(false);
      return;
    }
    close();
    onDeleted();
  }

  return (
    <>
      <p className="mt-3">
        {t.rich("deleteQuestion", {
          member: member.nameAr,
          name: (chunks) => (
            <strong lang="ar" dir="rtl" className="break-words">
              {chunks}
            </strong>
          ),
        })}
      </p>
      <p className="mt-3">{t("deleteWarning")}</p>
      <div aria-live="polite" className="empty:hidden">
        {problem && (
          <div className="mt-4">
            <ProblemNotice problem={problem} onRateDone={() => setProblem(null)} />
          </div>
        )}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={confirm}
          disabled={busy || isRateLimited(problem)}
          className={dangerButton}
        >
          {busy ? t("deleting") : t("deleteYes")}
        </button>
        <button ref={cancelRef} type="button" onClick={close} disabled={busy} className={neutralButton}>
          {t("cancel")}
        </button>
      </div>
    </>
  );
}
