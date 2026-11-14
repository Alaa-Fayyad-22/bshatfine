"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  disableUser,
  enableUser,
  forceLogoutUser,
  resetUserPassword,
  STAFF_ROLES,
  unlockUser,
  updateUser,
  type StaffRole,
  type StaffUserDto,
  type TemporaryPasswordResult,
} from "@/lib/admin-api";
import { toProblem, type Problem } from "@/lib/problem";
import { Modal, useModalClose } from "./Modal";
import { isRateLimited, ProblemNotice } from "./ProblemNotice";
import { UserStatus } from "./UserStatus";

type Action = "disable" | "enable" | "resetPassword" | "forceLogout" | "unlock";

const field =
  "mt-1 block min-h-11 w-full rounded-control border border-ink/40 bg-paper px-3 py-2 read-only:bg-stone disabled:bg-stone aria-[invalid=true]:border-alert-danger";
const button =
  "inline-flex min-h-11 items-center justify-center rounded-control border px-5 font-semibold disabled:cursor-not-allowed disabled:opacity-50";

export function UserManageDialog({
  user,
  isSelf,
  onChanged,
  onReset,
  onClose,
}: {
  user: StaffUserDto;
  isSelf: boolean;
  onChanged: (user: StaffUserDto) => void;
  // A password reset hands over the one-time password; the caller shows it and drops it.
  onReset: (result: TemporaryPasswordResult) => void;
  onClose: () => void;
}) {
  const t = useTranslations("Admin.users.manage");
  return (
    <Modal title={t("title", { name: user.displayName })} onClose={onClose}>
      <Body user={user} isSelf={isSelf} onChanged={onChanged} onReset={onReset} />
    </Modal>
  );
}

function Body({
  user,
  isSelf,
  onChanged,
  onReset,
}: {
  user: StaffUserDto;
  isSelf: boolean;
  onChanged: (user: StaffUserDto) => void;
  onReset: (result: TemporaryPasswordResult) => void;
}) {
  const t = useTranslations("Admin.users.manage");
  const tf = useTranslations("Admin.users");
  const close = useModalClose();
  const uid = useId();

  const [name, setName] = useState(user.displayName);
  const [role, setRole] = useState<StaffRole>(user.role);
  const [nameMissing, setNameMissing] = useState(false);
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [busy, setBusy] = useState<"save" | Action | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const sending = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  const locked = busy !== null || isRateLimited(problem);
  const dirty = name.trim() !== user.displayName || role !== user.role;

  // One request at a time; every outcome ends in a message the person can read.
  async function run<T>(kind: "save" | Action, call: () => Promise<T>, then: (r: T) => void) {
    if (sending.current) return;
    sending.current = true;
    setBusy(kind);
    setProblem(null);
    setMessage(null);
    try {
      then(await call());
    } catch (e) {
      setProblem(toProblem(e));
    } finally {
      sending.current = false;
      setBusy(null);
      setConfirm(null);
      // The confirmation panel (and the button that opened it) is gone: keep
      // keyboard focus inside the dialog, on the list of actions.
      setTimeout(() => actionsRef.current?.focus(), 0);
    }
  }

  function onSave(e: FormEvent) {
    e.preventDefault();
    if (locked || !dirty) return;
    if (!name.trim()) {
      setNameMissing(true);
      nameRef.current?.focus();
      return;
    }
    setNameMissing(false);
    void run(
      "save",
      () => updateUser(user.id, { displayName: name.trim(), role }),
      (updated) => {
        onChanged(updated);
        setName(updated.displayName);
        setRole(updated.role);
        setMessage(updated.role !== user.role ? t("roleChangedOk") : t("savedOk"));
      },
    );
  }

  function onConfirm() {
    if (!confirm || locked) return;
    const action = confirm;
    switch (action) {
      case "disable":
        return void run(action, () => disableUser(user.id), (u) => {
          onChanged(u);
          setMessage(t("disabledOk"));
        });
      case "enable":
        return void run(action, () => enableUser(user.id), (u) => {
          onChanged(u);
          setMessage(t("enabledOk"));
        });
      case "forceLogout":
        return void run(action, () => forceLogoutUser(user.id), (u) => {
          onChanged(u);
          setMessage(t("forceLogoutOk"));
        });
      case "unlock":
        return void run(action, () => unlockUser(user.id), (u) => {
          onChanged(u);
          setMessage(t("unlockedOk"));
        });
      case "resetPassword":
        return void run(action, () => resetUserPassword(user.id), (result) => {
          onChanged(result.user);
          onReset(result); // the parent shows it in the one-time dialog...
          close(); // ...and this dialog goes away
        });
    }
  }

  function ask(action: Action) {
    setConfirm(action);
    setProblem(null);
    setMessage(null);
    setTimeout(() => confirmRef.current?.focus(), 0);
  }

  const actions: { action: Action; show: boolean; danger?: boolean }[] = [
    { action: user.isActive ? "disable" : "enable", show: user.isActive ? !isSelf : true, danger: user.isActive },
    { action: "resetPassword", show: !isSelf },
    { action: "forceLogout", show: !isSelf },
    { action: "unlock", show: user.isLockedOut },
  ];

  return (
    <div className="mt-3 space-y-6">
      <div>
        <p dir="ltr" className="break-all text-start text-ink/80">
          {user.email}
        </p>
        <p className="mt-1 text-sm">
          <UserStatus user={user} />
        </p>
      </div>

      {isSelf && (
        <p role="note" className="border-s-4 border-gold bg-stone px-4 py-3 text-base">
          {t("selfNote")}
        </p>
      )}

      <form onSubmit={onSave} noValidate className="space-y-4">
        <div>
          <label htmlFor={`${uid}-name`} className="block font-medium">
            {tf("fieldName")}
          </label>
          <input
            ref={nameRef}
            id={`${uid}-name`}
            type="text"
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={nameMissing || undefined}
            aria-describedby={nameMissing ? `${uid}-name-err` : undefined}
            className={field}
          />
          {nameMissing && (
            <p id={`${uid}-name-err`} className="mt-1 text-alert-danger">
              {t("nameRequired")}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={`${uid}-role`} className="block font-medium">
            {tf("fieldRole")}
          </label>
          <select
            id={`${uid}-role`}
            value={role}
            disabled={isSelf}
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
        <button
          type="submit"
          disabled={locked || !dirty}
          className={`${button} border-pine bg-pine text-paper`}
        >
          {busy === "save" ? t("saving") : t("save")}
        </button>
      </form>

      <div
        ref={actionsRef}
        tabIndex={-1}
        role="group"
        aria-labelledby={`${uid}-actions`}
        className="border-t border-line pt-5 outline-none"
      >
        <h3 id={`${uid}-actions`} className="font-semibold">
          {t("actionsTitle")}
        </h3>

        {confirm === null ? (
          <ul className="mt-3 flex flex-wrap gap-3">
            {actions
              .filter((a) => a.show)
              .map(({ action, danger }) => (
                <li key={action}>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => ask(action)}
                    className={`${button} bg-paper ${
                      danger ? "border-alert-danger text-alert-danger" : "border-pine text-pine"
                    }`}
                  >
                    {t(`action.${action}`)}
                  </button>
                </li>
              ))}
          </ul>
        ) : (
          <div
            ref={confirmRef}
            tabIndex={-1}
            role="alertdialog"
            aria-label={t(`action.${confirm}`)}
            className="mt-3 border border-alert-danger p-4 outline-none"
          >
            <p>{t(`confirm.${confirm}`, { name: user.displayName })}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onConfirm}
                disabled={locked}
                className={`${button} border-alert-danger bg-alert-danger text-paper`}
              >
                {busy === confirm ? t("working") : t(`yes.${confirm}`)}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirm(null);
                  setTimeout(() => actionsRef.current?.focus(), 0);
                }}
                disabled={busy !== null}
                className={`${button} border-ink/40 bg-paper`}
              >
                {tf("cancel")}
              </button>
            </div>
          </div>
        )}
      </div>

      <div aria-live="polite" role="status" className="empty:hidden">
        {message && (
          <p className="border-s-4 border-pine bg-stone px-4 py-3 font-medium text-pine">
            {message}
          </p>
        )}
      </div>
      <ProblemNotice problem={problem} onRateDone={() => setProblem(null)} />

      <div className="border-t border-line pt-4">
        <button type="button" onClick={close} className={`${button} border-ink/40 bg-paper`}>
          {t("close")}
        </button>
      </div>
    </div>
  );
}
