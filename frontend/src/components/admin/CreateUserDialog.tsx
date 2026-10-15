"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { createUser, STAFF_ROLES, type StaffRole, type TemporaryPasswordResult } from "@/lib/admin-api";
import { toProblem, type Problem } from "@/lib/problem";
import { Modal, useModalClose } from "./Modal";
import { isRateLimited, ProblemNotice } from "./ProblemNotice";

const field =
  "mt-1 block min-h-11 w-full rounded-control border border-ink/40 bg-ivory px-3 py-2 aria-[invalid=true]:border-alert-danger";
const button =
  "inline-flex min-h-11 items-center justify-center rounded-control border px-5 font-semibold disabled:cursor-not-allowed disabled:opacity-50";

export function CreateUserDialog({
  onCreated,
  onClose,
}: {
  // Hands over the one-time password; the caller shows it and drops it.
  onCreated: (result: TemporaryPasswordResult) => void;
  onClose: () => void;
}) {
  const t = useTranslations("Admin.users.create");
  return (
    <Modal title={t("title")} onClose={onClose}>
      <Form onCreated={onCreated} />
    </Modal>
  );
}

function Form({ onCreated }: { onCreated: (result: TemporaryPasswordResult) => void }) {
  const t = useTranslations("Admin.users.create");
  const tf = useTranslations("Admin.users");
  const close = useModalClose();
  const uid = useId();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("Editor");
  const [missing, setMissing] = useState<("email" | "name")[]>([]);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending.current || isRateLimited(problem)) return;
    const list: ("email" | "name")[] = [];
    if (!email.trim()) list.push("email");
    if (!name.trim()) list.push("name");
    setMissing(list);
    if (list.length > 0) {
      (list[0] === "email" ? emailRef : nameRef).current?.focus();
      return;
    }
    sending.current = true;
    setBusy(true);
    setProblem(null);
    try {
      const result = await createUser({ email: email.trim(), displayName: name.trim(), role });
      onCreated(result);
      close();
    } catch (err) {
      setProblem(toProblem(err));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  const errId = `${uid}-errors`;
  return (
    <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4">
      <p className="text-ink/80">{t("intro")}</p>
      <div>
        <label htmlFor={`${uid}-name`} className="block font-medium">
          {tf("fieldName")}
        </label>
        <input
          ref={nameRef}
          id={`${uid}-name`}
          type="text"
          maxLength={100}
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={missing.includes("name") || undefined}
          aria-describedby={missing.length > 0 ? errId : undefined}
          className={field}
        />
      </div>
      <div>
        <label htmlFor={`${uid}-email`} className="block font-medium">
          {tf("fieldEmail")}
        </label>
        <input
          ref={emailRef}
          id={`${uid}-email`}
          type="email"
          dir="ltr"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={missing.includes("email") || undefined}
          aria-describedby={missing.length > 0 ? errId : undefined}
          className={field}
        />
      </div>
      <div>
        <label htmlFor={`${uid}-role`} className="block font-medium">
          {tf("fieldRole")}
        </label>
        <select
          id={`${uid}-role`}
          value={role}
          onChange={(e) => setRole(e.target.value as StaffRole)}
          className={field}
        >
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {tf(`role.${r}`)}
            </option>
          ))}
        </select>
      </div>

      <div id={errId} aria-live="assertive" aria-atomic="true" className="space-y-3 empty:hidden">
        {missing.map((m) => (
          <p
            key={m}
            className="border-s-4 border-alert-danger bg-sand px-4 py-3 text-alert-danger"
          >
            {t(m === "email" ? "emailRequired" : "nameRequired")}
          </p>
        ))}
      </div>
      <ProblemNotice problem={problem} onRateDone={() => setProblem(null)} />

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={busy || isRateLimited(problem)}
          className={`${button} border-cedar bg-cedar text-ivory`}
        >
          {busy ? t("creating") : t("submit")}
        </button>
        <button
          type="button"
          onClick={close}
          disabled={busy}
          className={`${button} border-ink/40 bg-ivory`}
        >
          {tf("cancel")}
        </button>
      </div>
    </form>
  );
}
