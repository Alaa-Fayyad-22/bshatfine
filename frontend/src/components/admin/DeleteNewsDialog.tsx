"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { deleteNews } from "@/lib/admin-api";
import { toProblem, type Problem } from "@/lib/problem";
import { Modal, useModalClose } from "./Modal";
import { isRateLimited, ProblemNotice } from "./ProblemNotice";

// Set by the edit page after it deleted a draft (value: the title); the list
// shows the success message once.
export const DELETED_FLASH_KEY = "admin-news-deleted";

const button =
  "inline-flex min-h-11 items-center justify-center rounded-control border px-5 font-semibold disabled:cursor-not-allowed disabled:opacity-50";

// Confirmation for deleting a DRAFT. It names the article, says what is lost,
// and keeps the server's own message on screen if the API refuses (for example a
// 400 because the article was published meanwhile).
export function DeleteNewsDialog({
  id,
  title,
  lang,
  onDeleted,
  onClose,
}: {
  id: string;
  title: string;
  lang?: string;
  // Runs once the API has deleted the article; the dialog closes itself first.
  onDeleted: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("Admin.delete");
  return (
    <Modal title={t("title")} onClose={onClose}>
      <Body id={id} title={title} lang={lang} onDeleted={onDeleted} />
    </Modal>
  );
}

function Body({
  id,
  title,
  lang,
  onDeleted,
}: {
  id: string;
  title: string;
  lang?: string;
  onDeleted: () => void;
}) {
  const t = useTranslations("Admin.delete");
  const close = useModalClose();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const sending = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Start on the harmless button. (The dialog is opened by the parent's effect,
  // which runs after this one, so the focus call waits a tick.)
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
      await deleteNews(id);
    } catch (e) {
      setProblem(toProblem(e));
      sending.current = false;
      setBusy(false);
      return;
    }
    close();
    onDeleted();
  }

  const locked = busy || isRateLimited(problem);

  return (
    <>
      <p className="mt-3">
        {t.rich("question", {
          title,
          name: (chunks) => (
            <strong lang={lang} dir="auto" className="break-words">
              {chunks}
            </strong>
          ),
        })}
      </p>
      <p className="mt-3">{t("warning")}</p>
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
          disabled={locked}
          className={`${button} border-alert-danger bg-alert-danger text-ivory`}
        >
          {busy ? t("deleting") : t("yes")}
        </button>
        <button
          ref={cancelRef}
          type="button"
          onClick={close}
          disabled={busy}
          className={`${button} border-ink/40 bg-ivory`}
        >
          {t("cancel")}
        </button>
      </div>
    </>
  );
}
