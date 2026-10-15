"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { changePassword } from "@/lib/auth-api";
import { LOGIN_PATH } from "@/lib/return-to";
import { rateProblem, type Problem } from "@/lib/problem";
import { isRateLimited, ProblemNotice } from "./ProblemNotice";

type Missing = "currentRequired" | "newRequired" | "confirmRequired" | "mismatch";

const field =
  "mt-1 block min-h-11 w-full rounded-control border border-ink/40 bg-ivory px-3 py-2 aria-[invalid=true]:border-alert-danger";
const primary =
  "inline-flex min-h-11 w-full items-center justify-center rounded-control border border-cedar bg-cedar px-5 font-semibold text-ivory disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto";

// Used twice: on the "Choose your password" page (a temporary password must be
// replaced; `onChanged` continues to the admin) and on the normal "Change
// password" page. The passwords live only in this component's state while the
// person types, and are cleared as soon as they are sent.
export function ChangePasswordForm({
  forced,
  onChanged,
}: {
  forced: boolean;
  onChanged?: () => void;
}) {
  const t = useTranslations("Admin.password");
  const ta = useTranslations("Admin.auth");
  const locale = useLocale();
  const uid = useId();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [missing, setMissing] = useState<Missing[]>([]);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const sending = useRef(false);

  const currentRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const rateLimited = isRateLimited(problem);
  const busy = submitting || rateLimited;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending.current || rateLimited) return;

    const list: Missing[] = [];
    if (!current) list.push("currentRequired");
    if (!next) list.push("newRequired");
    if (!confirm) list.push("confirmRequired");
    else if (next && confirm !== next) list.push("mismatch");
    setMissing(list);
    setDone(false);
    if (list.length > 0) {
      const first = list[0];
      (first === "currentRequired"
        ? currentRef
        : first === "newRequired"
          ? nextRef
          : confirmRef
      ).current?.focus();
      return;
    }

    sending.current = true;
    setSubmitting(true);
    setProblem(null);
    const result = await changePassword(current, next);
    sending.current = false;
    setSubmitting(false);

    if (result.ok) {
      setCurrent("");
      setNext("");
      setConfirm("");
      if (forced) {
        sending.current = true; // stay disabled while the page changes
        setSubmitting(true);
        onChanged?.();
      } else {
        setDone(true);
      }
      return;
    }

    switch (result.error) {
      case "unauthorized":
        // The session ended: a full page load, so nothing typed stays around.
        window.location.replace(`/${locale}${LOGIN_PATH}?expired=1`);
        return;
      case "rateLimited":
        setProblem(rateProblem(result.retryAfter));
        return;
      case "network":
        setProblem({ kind: "network" });
        return;
      case "unknown":
        // 400: the API's own message (wrong current password, same password, weak password).
        setProblem(
          result.detail ? { kind: "detail", text: result.detail } : { kind: "api", status: 400 },
        );
        currentRef.current?.focus();
        return;
      default:
        setProblem({ kind: "detail", text: ta("server") });
    }
  }

  const errId = `${uid}-errors`;
  const rulesId = `${uid}-rules`;
  const has = (m: Missing) => missing.includes(m) || undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div id={rulesId} className="border-s-4 border-gold bg-sand px-4 py-3 text-base">
        <p className="font-semibold">{t("rulesTitle")}</p>
        <ul className="mt-1 list-disc ps-5">
          <li>{t("ruleLength")}</li>
          <li>{t("ruleUpper")}</li>
          <li>{t("ruleLower")}</li>
          <li>{t("ruleDigit")}</li>
        </ul>
        <p className="mt-2 text-ink/80">{t("passphraseHint")}</p>
      </div>

      <div>
        <label htmlFor={`${uid}-current`} className="block font-medium">
          {forced ? t("currentTemporary") : t("current")}
        </label>
        <input
          ref={currentRef}
          id={`${uid}-current`}
          type="password"
          dir="ltr"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          aria-invalid={has("currentRequired")}
          aria-describedby={missing.length > 0 || problem ? errId : undefined}
          className={field}
        />
      </div>
      <div>
        <label htmlFor={`${uid}-new`} className="block font-medium">
          {t("new")}
        </label>
        <input
          ref={nextRef}
          id={`${uid}-new`}
          type="password"
          dir="ltr"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          aria-invalid={has("newRequired")}
          aria-describedby={`${rulesId}${missing.length > 0 ? ` ${errId}` : ""}`}
          className={field}
        />
      </div>
      <div>
        <label htmlFor={`${uid}-confirm`} className="block font-medium">
          {t("confirm")}
        </label>
        <input
          ref={confirmRef}
          id={`${uid}-confirm`}
          type="password"
          dir="ltr"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={has("confirmRequired") ?? has("mismatch")}
          aria-describedby={missing.length > 0 ? errId : undefined}
          className={field}
        />
      </div>

      {/* Always in the page, so screen readers announce what appears in it */}
      <div id={errId} aria-live="assertive" aria-atomic="true" className="space-y-3 empty:hidden">
        {missing.map((m) => (
          <p
            key={m}
            className="border-s-4 border-alert-danger bg-sand px-4 py-3 text-alert-danger"
          >
            <span className="sr-only">{ta("errorLabel")}: </span>
            {t(m)}
          </p>
        ))}
      </div>
      <ProblemNotice problem={problem} onRateDone={() => setProblem(null)} />
      <div aria-live="polite" role="status" className="empty:hidden">
        {done && (
          <p className="border-s-4 border-cedar bg-sand px-4 py-3 font-medium text-cedar">
            {t("changedOk")}
          </p>
        )}
      </div>

      <button type="submit" disabled={busy} className={primary}>
        {submitting ? t("saving") : forced ? t("submitForced") : t("submit")}
      </button>
    </form>
  );
}
