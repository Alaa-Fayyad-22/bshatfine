"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal, useModalClose } from "./Modal";

const button =
  "inline-flex min-h-11 items-center justify-center rounded-control border px-5 font-semibold disabled:cursor-not-allowed disabled:opacity-50";

// Shows a temporary password exactly once. The parent keeps the password only
// while this dialog is mounted and drops it in `onClose`: it is never written to
// storage, the URL or history, and not kept anywhere after the dialog closes.
export function PasswordRevealDialog({
  name,
  email,
  password,
  onClose,
}: {
  name: string;
  email: string;
  password: string;
  onClose: () => void;
}) {
  const t = useTranslations("Admin.users.reveal");
  return (
    <Modal title={t("title", { name })} onClose={onClose}>
      <Body email={email} password={password} />
    </Modal>
  );
}

function Body({ email, password }: { email: string; password: string }) {
  const t = useTranslations("Admin.users.reveal");
  const close = useModalClose();
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopy("copied");
    } catch {
      setCopy("failed"); // clipboard blocked: the password is still on screen to copy by hand
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <p role="note" className="border-s-4 border-alert-warn bg-stone px-4 py-3">
        <strong className="block">{t("warningTitle")}</strong>
        {t("warningBody")}
      </p>
      <dl className="space-y-3">
        <div>
          <dt className="text-sm text-ink/70">{t("account")}</dt>
          <dd dir="ltr" className="break-all text-start font-medium">
            {email}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink/70">{t("password")}</dt>
          <dd>
            <code
              dir="ltr"
              className="block rounded-control border border-ink/40 bg-stone px-3 py-2 text-start font-mono text-lg break-all select-all"
            >
              {password}
            </code>
          </dd>
        </div>
      </dl>
      <div aria-live="polite" role="status" className="empty:hidden">
        {copy === "copied" && <p className="font-medium text-pine">{t("copied")}</p>}
        {copy === "failed" && <p className="text-alert-danger">{t("copyFailed")}</p>}
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onCopy}
          className={`${button} border-pine bg-paper text-pine`}
        >
          {t("copy")}
        </button>
        <button type="button" onClick={close} className={`${button} border-pine bg-pine text-paper`}>
          {t("done")}
        </button>
      </div>
    </div>
  );
}
