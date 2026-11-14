"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  AdminApiError,
  getAdminSiteSettings,
  updateSiteSettings,
  type AdminSiteSettingsDto,
} from "@/lib/admin-api";
import { rateProblem, type Problem } from "@/lib/problem";
import { ConflictNotice, inputClass, primaryButton } from "./AdminControls";
import { isRateLimited, ProblemNotice } from "./ProblemNotice";

const TEXT_MAX = 300;

type Field =
  | "phone"
  | "secondaryPhone"
  | "email"
  | "addressAr"
  | "addressEn"
  | "openingHoursAr"
  | "openingHoursEn"
  | "mapUrl"
  | "facebookUrl"
  | "instagramUrl";
type Values = Record<Field, string>;

const emptyValues: Values = {
  phone: "",
  secondaryPhone: "",
  email: "",
  addressAr: "",
  addressEn: "",
  openingHoursAr: "",
  openingHoursEn: "",
  mapUrl: "",
  facebookUrl: "",
  instagramUrl: "",
};

function toValues(dto: AdminSiteSettingsDto): Values {
  const v = { ...emptyValues };
  for (const k of Object.keys(v) as Field[]) v[k] = dto[k] ?? "";
  return v;
}

// Hints only: they never block saving. The server has the last word and its own
// message is shown when it refuses a value.
const looksLikePhone = (s: string) => /^\+?[0-9][0-9 \-()]{4,28}$/.test(s.trim());
const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
const looksLikeHttps = (s: string) => /^https:\/\/\S+$/i.test(s.trim());

type Kind = "phone" | "email" | "url" | "text";
const checks: Record<Exclude<Kind, "text">, (s: string) => boolean> = {
  phone: looksLikePhone,
  email: looksLikeEmail,
  url: looksLikeHttps,
};

export function ContactForm() {
  const t = useTranslations("Admin.contact");
  const tf = useTranslations("Admin.form");
  const format = useFormatter();
  const uid = useId();

  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const [dto, setDto] = useState<AdminSiteSettingsDto | null>(null);
  const [values, setValues] = useState<Values>(emptyValues);
  const [baseline, setBaseline] = useState(JSON.stringify(emptyValues));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rate, setRate] = useState<Problem | null>(null);
  const [conflict, setConflict] = useState(false);
  const [reloading, setReloading] = useState(false);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const [statusFocus, setStatusFocus] = useState(0);
  useEffect(() => {
    if (statusFocus > 0) statusRef.current?.focus();
  }, [statusFocus]);

  const dirty = JSON.stringify(values) !== baseline;
  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  const waiting = isRateLimited(rate);

  function apply(next: AdminSiteSettingsDto) {
    const v = toValues(next);
    setConflict(false);
    setDto(next);
    setValues(v);
    setBaseline(JSON.stringify(v));
  }

  useEffect(() => {
    let cancelled = false;
    getAdminSiteSettings().then(
      (next) => {
        if (cancelled) return;
        apply(next);
        setLoad("ready");
      },
      () => !cancelled && setLoad("error"),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Warn before leaving with unsaved changes (tab close, reload, in-app links).
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      if (a.origin !== location.origin) return;
      if (a.pathname === location.pathname && a.search === location.search) return;
      if (!window.confirm(tf("leaveConfirm"))) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [tf]);

  function describe(e: unknown): string {
    if (e instanceof AdminApiError) return e.detail ?? tf("apiError", { status: e.status });
    return tf("networkError");
  }

  async function save() {
    if (!dto || busy || waiting) return;
    setBusy(true);
    setError(null);
    setRate(null);
    setSuccess(null);
    try {
      apply(await updateSiteSettings(values, dto.version));
      setSuccess(t("savedOk"));
      setStatusFocus((n) => n + 1);
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 429) setRate(rateProblem(e.retryAfter));
      else if (e instanceof AdminApiError && e.status === 409) setConflict(true);
      else setError(describe(e));
    } finally {
      setBusy(false);
    }
  }

  async function loadLatest() {
    setReloading(true);
    try {
      apply(await getAdminSiteSettings());
      setError(null);
      setSuccess(tf("latestLoadedOk"));
      setStatusFocus((n) => n + 1);
    } catch (e) {
      setError(describe(e));
    } finally {
      setReloading(false);
    }
  }

  if (load === "loading") {
    return (
      <p role="status" className="text-ink/70">
        {t("loading")}
      </p>
    );
  }
  if (load === "error") {
    return (
      <p role="alert" className="max-w-prose">
        {t("loadError")}
      </p>
    );
  }

  // One labelled input with its hint, and a (non-blocking) warning when the
  // value does not look right.
  const field = (
    name: Field,
    label: string,
    kind: Kind,
    hint: string,
    opts: { multiline?: boolean } = {},
  ) => {
    const value = values[name];
    const warn =
      kind !== "text" && value.trim() !== "" && !checks[kind](value)
        ? t(kind === "phone" ? "phoneLooksWrong" : kind === "email" ? "emailLooksWrong" : "urlLooksWrong")
        : null;
    const id = `${uid}-${name}`;
    const latin = kind !== "text";
    const props = {
      id,
      value,
      readOnly: busy,
      "aria-describedby": `${id}-hint${warn ? ` ${id}-warn` : ""}`,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setValues((v) => ({ ...v, [name]: e.target.value })),
      // Phone numbers, emails and links are Latin text: keep them left-to-right
      // even on the Arabic page.
      ...(latin ? { dir: "ltr" as const } : { lang: name.endsWith("Ar") ? "ar" : "en", dir: name.endsWith("Ar") ? ("rtl" as const) : ("ltr" as const) }),
    };
    return (
      <div>
        <label htmlFor={id} className="block font-medium">
          {label}
        </label>
        {opts.multiline ? (
          <textarea {...props} rows={2} maxLength={TEXT_MAX} className={`${inputClass} leading-relaxed`} />
        ) : (
          <input
            {...props}
            type={kind === "email" ? "email" : kind === "phone" ? "tel" : kind === "url" ? "url" : "text"}
            autoComplete="off"
            inputMode={kind === "phone" ? "tel" : undefined}
            className={inputClass}
          />
        )}
        <p id={`${id}-hint`} className="mt-1 text-sm text-ink/70">
          {hint}
        </p>
        {warn && (
          <p id={`${id}-warn`} className="mt-1 text-sm font-medium text-alert-warn">
            {warn}
          </p>
        )}
      </div>
    );
  };

  const group = "mt-8 border-t border-line pt-6";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      noValidate
      className="max-w-3xl"
    >
      <h1 className="text-2xl font-bold md:text-3xl">{t("title")}</h1>
      <p className="mt-2 max-w-prose text-ink/80">{t("intro")}</p>
      <p className="mt-2 text-sm text-ink/70">
        {dto?.updatedAt
          ? t("updated", {
              date: format.dateTime(new Date(dto.updatedAt), { dateStyle: "medium", timeStyle: "short" }),
            })
          : t("notSavedYet")}
      </p>

      <fieldset className={group}>
        <legend className="text-lg font-bold">{t("groupPhones")}</legend>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {field("phone", t("phone"), "phone", t("phoneHint"))}
          {field("secondaryPhone", t("secondaryPhone"), "phone", t("phoneHint"))}
          <div className="md:col-span-2">{field("email", t("email"), "email", t("emailHint"))}</div>
        </div>
      </fieldset>

      <fieldset className={group}>
        <legend className="text-lg font-bold">{t("groupAddress")}</legend>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {field("addressAr", t("addressAr"), "text", t("textHint"), { multiline: true })}
          {field("addressEn", t("addressEn"), "text", t("textHint"), { multiline: true })}
          {field("openingHoursAr", t("hoursAr"), "text", t("textHint"), { multiline: true })}
          {field("openingHoursEn", t("hoursEn"), "text", t("textHint"), { multiline: true })}
        </div>
      </fieldset>

      <fieldset className={group}>
        <legend className="text-lg font-bold">{t("groupLinks")}</legend>
        <div className="mt-4 grid gap-6">
          {field("mapUrl", t("mapUrl"), "url", t("urlHint"))}
          {field("facebookUrl", t("facebookUrl"), "url", t("urlHint"))}
          {field("instagramUrl", t("instagramUrl"), "url", t("urlHint"))}
        </div>
      </fieldset>

      <div className="mt-8 border-t border-line pt-6">
        <div ref={statusRef} tabIndex={-1} aria-live="polite" role="status" className="outline-none empty:hidden">
          {success && <p className="mb-4 font-medium text-pine">{success}</p>}
          {dirty && !success && !error && <p className="mb-4 text-sm text-ink/70">{tf("unsaved")}</p>}
        </div>
        {error && (
          <p role="alert" className="mb-4 border-s-4 border-alert-danger bg-stone px-4 py-3 text-alert-danger">
            <span className="sr-only">{tf("errorTitle")}: </span>
            {error}
          </p>
        )}
        {rate && (
          <div className="mb-4">
            <ProblemNotice problem={rate} onRateDone={() => setRate(null)} />
          </div>
        )}
        <ConflictNotice
          open={conflict}
          title={t("conflictTitle")}
          text={t("conflictText")}
          loadLatest={tf("loadLatest")}
          loadLatestConfirm={tf("loadLatestConfirm")}
          loadLatestYes={tf("loadLatestYes")}
          loadingLatest={tf("loadingLatest")}
          cancel={tf("cancel")}
          reloading={reloading}
          onLoadLatest={loadLatest}
        />
        <button type="submit" disabled={busy || waiting || conflict} className={primaryButton}>
          {busy ? t("saving") : t("save")}
        </button>
      </div>
    </form>
  );
}
