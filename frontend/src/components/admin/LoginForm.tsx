"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getMe, login, loginTwoFactor, type AuthErrorKind } from "@/lib/auth-api";
import { rateProblem, type Problem as RateProblem } from "@/lib/problem";
import { LOGIN_PATH, safeReturnTo } from "@/lib/return-to";
import { isRateLimited, ProblemNotice } from "./ProblemNotice";

type Step = "credentials" | "code";
type Problem =
  | "emailRequired"
  | "passwordRequired"
  | "codeRequired"
  | "invalid"
  | "invalidCode"
  | "locked"
  | "network"
  | "server"
  | "forbiddenLogin";

// Everything the user can see about a failure comes from our own messages, never
// from the response, so no technical detail can leak onto the page.
function problemFor(error: AuthErrorKind, step: Step): Problem {
  switch (error) {
    case "unauthorized":
      return step === "code" ? "invalidCode" : "invalid";
    case "locked":
      return "locked";
    case "network":
      return "network";
    case "forbidden":
      return "forbiddenLogin";
    default:
      return "server";
  }
}

const field =
  "mt-1 block min-h-11 w-full rounded-control border border-ink/40 bg-ivory px-3 py-2 aria-[invalid=true]:border-alert-danger";
const primary =
  "inline-flex min-h-11 w-full items-center justify-center rounded-control border border-cedar bg-cedar px-5 font-semibold text-ivory disabled:cursor-not-allowed disabled:opacity-50";

export function LoginForm() {
  const t = useTranslations("Admin.auth");
  const tl = useTranslations("Language");
  const locale = useLocale();
  const params = useSearchParams();
  const uid = useId();

  const rawReturnTo = params.get("returnTo");
  const expired = params.get("expired") === "1";
  const returnTo = safeReturnTo(rawReturnTo, locale);

  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [problems, setProblems] = useState<Problem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // Too many requests from this address: counts down, then the button comes back.
  const [rate, setRate] = useState<RateProblem | null>(null);
  const waiting = isRateLimited(rate);
  const sending = useRef(false); // blocks a second request even before the re-render

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  // A full page load, not a client-side navigation: Next keeps the page we leave
  // alive in memory (with the typed email, the password and "signing in" state),
  // and it would reappear as it was after a logout. Reloading drops all of it.
  // `target` is always a validated "/{locale}/admin/..." path (safeReturnTo).
  function goTo(target: string) {
    window.location.replace(target);
  }

  // Already signed in? Skip the form.
  useEffect(() => {
    let cancelled = false;
    getMe().then((result) => {
      if (cancelled) return;
      if (result.ok) goTo(returnTo);
      else setChecking(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move focus to the code field when that step opens.
  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  function fail(list: Problem[], focus: HTMLElement | null) {
    setProblems(list);
    sending.current = false;
    setSubmitting(false);
    // The submit button was disabled a moment ago, so focus has to be put back.
    setTimeout(() => focus?.focus(), 0);
  }

  function limited(retryAfter: number | undefined) {
    setRate(rateProblem(retryAfter));
    sending.current = false;
    setSubmitting(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending.current || waiting) return;

    if (step === "credentials") {
      const missing: Problem[] = [];
      if (!email.trim()) missing.push("emailRequired");
      if (!password) missing.push("passwordRequired");
      if (missing.length > 0) {
        setProblems(missing);
        (missing[0] === "emailRequired" ? emailRef : passwordRef).current?.focus();
        return;
      }
      sending.current = true;
      setSubmitting(true);
      setProblems([]);
      const result = await login(email.trim(), password);
      if (result.ok && result.data.requiresTwoFactor) {
        setPassword(""); // not needed any more
        sending.current = false;
        setSubmitting(false);
        setStep("code");
        return;
      }
      if (result.ok) return goTo(returnTo); // stays "submitting" until the page changes
      if (result.error === "rateLimited") return limited(result.retryAfter);
      const problem = problemFor(result.error, "credentials");
      if (problem === "invalid") {
        setPassword("");
        return fail([problem], passwordRef.current);
      }
      return fail([problem], submitRef.current);
    }

    const clean = code.replace(/\s+/g, "");
    if (!clean) {
      setProblems(["codeRequired"]);
      codeRef.current?.focus();
      return;
    }
    sending.current = true;
    setSubmitting(true);
    setProblems([]);
    const result = await loginTwoFactor(clean);
    if (result.ok) return goTo(returnTo);
    if (result.error === "rateLimited") return limited(result.retryAfter);
    const problem = problemFor(result.error, "code");
    if (problem === "invalidCode") {
      setCode("");
      return fail([problem], codeRef.current);
    }
    return fail([problem], submitRef.current);
  }

  function startOver() {
    setStep("credentials");
    setCode("");
    setPassword("");
    setProblems([]);
    setTimeout(() => emailRef.current?.focus(), 0);
  }

  const heading = step === "code" ? t("twoFactorTitle") : t("loginTitle");
  const errId = `${uid}-errors`;
  const invalid = (p: Problem) => problems.includes(p) || undefined;
  const other = tl("code") as Locale;
  const switchQuery: Record<string, string> = {};
  if (rawReturnTo) switchQuery.returnTo = rawReturnTo;
  if (expired) switchQuery.expired = "1";

  return (
    <main id="main" className="grid flex-1 place-items-center p-4 md:p-10">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold md:text-3xl">{heading}</h1>

        {checking ? (
          <p role="status" className="mt-6 text-ink/70">
            {t("checking")}
          </p>
        ) : (
          <>
            <p className="mt-3 text-ink/80">
              {step === "code" ? t("twoFactorIntro") : t("loginIntro")}
            </p>

            {expired && (
              <p role="status" className="mt-6 border-s-4 border-alert-warn bg-sand px-4 py-3">
                {t("expired")}
              </p>
            )}

            <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
              {step === "credentials" ? (
                <>
                  <div>
                    <label htmlFor={`${uid}-email`} className="block font-medium">
                      {t("email")}
                    </label>
                    <input
                      ref={emailRef}
                      id={`${uid}-email`}
                      name="email"
                      type="email"
                      dir="ltr"
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-invalid={invalid("emailRequired")}
                      aria-describedby={problems.length > 0 ? errId : undefined}
                      className={field}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${uid}-password`} className="block font-medium">
                      {t("password")}
                    </label>
                    <input
                      ref={passwordRef}
                      id={`${uid}-password`}
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      aria-invalid={invalid("passwordRequired") ?? invalid("invalid")}
                      aria-describedby={problems.length > 0 ? errId : undefined}
                      className={field}
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label htmlFor={`${uid}-code`} className="block font-medium">
                    {t("code")}
                  </label>
                  <input
                    ref={codeRef}
                    id={`${uid}-code`}
                    name="code"
                    type="text"
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    spellCheck={false}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    aria-invalid={invalid("codeRequired") ?? invalid("invalidCode")}
                    aria-describedby={problems.length > 0 ? errId : undefined}
                    className={field}
                  />
                </div>
              )}

              {/* Always in the page, so screen readers announce what appears in it */}
              <div id={errId} aria-live="assertive" aria-atomic="true" className="empty:hidden">
                {problems.map((p) => (
                  <p
                    key={p}
                    className="border-s-4 border-alert-danger bg-sand px-4 py-3 text-alert-danger"
                  >
                    <span className="sr-only">{t("errorLabel")}: </span>
                    {t(p)}
                  </p>
                ))}
              </div>

              <ProblemNotice problem={rate} onRateDone={() => setRate(null)} />

              <button
                ref={submitRef}
                type="submit"
                disabled={submitting || waiting}
                className={primary}
              >
                {step === "code"
                  ? submitting
                    ? t("verifying")
                    : t("verify")
                  : submitting
                    ? t("signingIn")
                    : t("signIn")}
              </button>

              {step === "code" && (
                <button
                  type="button"
                  onClick={startOver}
                  disabled={submitting}
                  className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
                >
                  {t("startOver")}
                </button>
              )}
            </form>
          </>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-x-6 border-t border-hairline pt-4">
          <Link
            href={{ pathname: LOGIN_PATH, query: switchQuery }}
            locale={other}
            lang={other}
            hrefLang={other}
            aria-label={tl("switchLabel")}
            className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 font-medium underline-offset-4 hover:underline"
          >
            {tl("switchTo")}
          </Link>
        </div>
      </div>
    </main>
  );
}
