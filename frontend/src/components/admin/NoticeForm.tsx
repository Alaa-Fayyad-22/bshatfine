"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  isNoticeCategory,
  isNoticePriority,
  NOTICE_AREA_MAX,
  NOTICE_BODY_MAX,
  NOTICE_CATEGORIES,
  NOTICE_LANGUAGES,
  NOTICE_MAX_VALIDITY_DAYS,
  NOTICE_PRIORITIES,
  NOTICE_TITLE_MAX,
  NOTICE_YEAR_MAX,
  NOTICE_YEAR_MIN,
  type NoticeLanguage,
} from "@/config/notices";
import { Link, useRouter } from "@/i18n/navigation";
import {
  AdminApiError,
  createNotice,
  deleteNotice,
  getAdminNotice,
  publishNotice,
  unpublishNotice,
  updateNotice,
  type AdminNoticeDto,
  type NoticeInput,
  type NoticeTranslationDto,
} from "@/lib/admin-api";
import { beirutParts, beirutToIso, formatStamp } from "@/lib/event-time";
import { formatNumber, formatYear } from "@/lib/numbers";
import { rateProblem, type Problem } from "@/lib/problem";
import {
  ConfirmPanel,
  ConflictNotice,
  dangerOutlineButton,
  focusLater,
  inputClass,
  neutralButton,
  outlineButton,
  primaryButton,
} from "./AdminControls";
import { NOTICE_DELETED_FLASH_KEY, noticeStatus, noticeTitle, STATUS_DOT } from "./NoticesTable";
import { isRateLimited, ProblemNotice } from "./ProblemNotice";

type Lang = NoticeLanguage;
type Text = { title: string; body: string; area: string };
type Values = Record<Lang, Text>;
// As typed in the form ("" = empty). Dates are Beirut wall-clock values of a
// datetime-local input ("2026-12-20T18:00").
type Fields = { category: string; priority: string; validFrom: string; validUntil: string };
type Busy = "save" | "publish" | "unpublish" | "delete" | null;
type Confirm = "publish" | "unpublish" | "delete" | null;

const emptyText: Text = { title: "", body: "", area: "" };
const emptyValues = (): Values => ({ ar: { ...emptyText }, en: { ...emptyText } });
const emptyFields: Fields = { category: "", priority: "normal", validFrom: "", validUntil: "" };
const DAY_MS = 86_400_000;

const filled = (x: Text) => Object.values(x).some((v) => v.trim() !== "");
const snapshot = (values: Values, fields: Fields) => JSON.stringify({ values, fields });

function toValues(n: AdminNoticeDto): Values {
  const v = emptyValues();
  for (const tr of n.translations) {
    if (tr.language in v) v[tr.language] = { title: tr.title, body: tr.body ?? "", area: tr.area ?? "" };
  }
  return v;
}

// An instant from the API as the value of a datetime-local input, in Beirut time.
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const p = beirutParts(iso);
  return `${p.date}T${p.time}`;
}

function toFields(n: AdminNoticeDto): Fields {
  return {
    category: n.category ?? "",
    priority: n.priority ?? "normal",
    validFrom: toLocalInput(n.validFrom),
    validUntil: toLocalInput(n.validUntil),
  };
}

// "2026-12-20T18:00" (Beirut) -> "2026-12-20T18:00:00+02:00", "" -> null,
// undefined when it is not a valid date and time.
function fromLocalInput(value: string): string | null | undefined {
  const v = value.trim();
  if (v === "") return null;
  const [date, time] = v.split("T");
  if (!date || !time) return undefined;
  return beirutToIso(date, time.slice(0, 5)) ?? undefined;
}

type DateError = "fromInvalid" | "untilInvalid" | "yearRange" | "untilBeforeFrom" | "tooLong";

// The same rules as the API (Notice.cs): both optional, years 2000-2100,
// "until" after "from", at most 366 days apart.
function toValidity(f: Fields): { ok: true; from: string | null; until: string | null } | { ok: false; error: DateError } {
  const from = fromLocalInput(f.validFrom);
  if (from === undefined) return { ok: false, error: "fromInvalid" };
  const until = fromLocalInput(f.validUntil);
  if (until === undefined) return { ok: false, error: "untilInvalid" };
  for (const iso of [from, until]) {
    if (!iso) continue;
    const year = new Date(iso).getUTCFullYear();
    if (year < NOTICE_YEAR_MIN || year > NOTICE_YEAR_MAX) return { ok: false, error: "yearRange" };
  }
  if (from && until) {
    const span = new Date(until).getTime() - new Date(from).getTime();
    if (span <= 0) return { ok: false, error: "untilBeforeFrom" };
    if (span > NOTICE_MAX_VALIDITY_DAYS * DAY_MS) return { ok: false, error: "tooLong" };
  }
  return { ok: true, from, until };
}

// The editor of one notice. `id` edits an existing notice; without it, the
// first save creates it (and the address becomes the notice's own).
export function NoticeForm({ id }: { id?: string }) {
  const t = useTranslations("Admin.noticeForm");
  const tf = useTranslations("Admin.form");
  const ts = useTranslations("Admin.notices");
  const tn = useTranslations("Notices");
  const locale = useLocale();
  const num = (value: number) => formatNumber(value, locale);
  const router = useRouter();
  const uid = useId();

  const [load, setLoad] = useState<"loading" | "ready" | "error" | "notfound">(id ? "loading" : "ready");
  // null until the notice exists (the first save creates it).
  const [notice, setNotice] = useState<AdminNoticeDto | null>(null);
  const [now, setNow] = useState(0);
  const [values, setValues] = useState<Values>(emptyValues);
  const [fields, setFields] = useState<Fields>(emptyFields);
  const [baseline, setBaseline] = useState(() => snapshot(emptyValues(), emptyFields));
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rate, setRate] = useState<Problem | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  // Someone else saved this notice after it was loaded (the API answered 409).
  const [conflict, setConflict] = useState(false);
  const [reloading, setReloading] = useState(false);
  const publishBtnRef = useRef<HTMLButtonElement | null>(null);
  const unpublishBtnRef = useRef<HTMLButtonElement | null>(null);
  const deleteBtnRef = useRef<HTMLButtonElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  // The status message only becomes focusable after the render that shows it.
  const [statusFocus, setStatusFocus] = useState(0);
  const focusStatus = () => setStatusFocus((n) => n + 1);
  useEffect(() => {
    if (statusFocus > 0) statusRef.current?.focus();
  }, [statusFocus]);

  const dirty = snapshot(values, fields) !== baseline;
  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const waiting = isRateLimited(rate);
  const readOnly = busy !== null;
  const published = notice?.isPublished ?? false;
  const urgent = fields.priority === "urgent";

  // Adopt a notice the API returned: its fields AND its new version number.
  function apply(dto: AdminNoticeDto) {
    const v = toValues(dto);
    const f = toFields(dto);
    setConflict(false);
    adoptState(dto);
    setValues(v);
    setFields(f);
    setBaseline(snapshot(v, f));
  }

  // Adopt only the state and version (publish...): what is typed and not saved
  // yet stays as it is. The status is judged against the time it was received.
  function adoptState(dto: AdminNoticeDto) {
    setNotice(dto);
    setNow(Date.now());
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getAdminNotice(id).then(
      (dto) => {
        if (cancelled) return;
        if (!dto) return setLoad("notfound");
        apply(dto);
        setLoad("ready");
      },
      () => !cancelled && setLoad("error"),
    );
    return () => {
      cancelled = true;
    };
    // Loads once per id; `apply` only sets state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Warn before closing the tab with unsaved changes (the browser's own prompt).
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // The server's own message whenever it gave one (business rules are 400s
  // with the reason), so nothing ever fails silently.
  function describe(e: unknown): string {
    if (e instanceof AdminApiError) {
      if (e.detail) return e.detail;
      if (e.status === 404) return t("gone");
      return tf("apiError", { status: num(e.status) });
    }
    return tf("networkError");
  }

  async function run(action: Exclude<Busy, null>, work: () => Promise<void>) {
    setBusy(action);
    setError(null);
    setRate(null);
    setSuccess(null);
    try {
      await work();
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 429) setRate(rateProblem(e.retryAfter));
      else if (e instanceof AdminApiError && e.status === 409) {
        // Keep everything the person typed; offer to load the saved version.
        setConflict(true);
        setConfirm(null);
      } else {
        setError(describe(e));
        focusStatus();
      }
    } finally {
      setBusy(null);
    }
  }

  function fail(message: string) {
    setSuccess(null);
    setError(message);
    setConfirm(null);
    focusStatus();
    return null;
  }

  const validity = toValidity(fields);
  const langName = (l: Lang) => tn(`languages.${l}`);

  // Returns null (with a message) when something must be fixed first. The
  // languages sent become the notice's languages: English is sent only when
  // something was typed in it.
  function collect(): NoticeInput | null {
    const translations: NoticeTranslationDto[] = [];
    for (const l of NOTICE_LANGUAGES) {
      const v = values[l];
      if (l === "en" && !filled(v)) continue;
      if (!v.title.trim()) return fail(l === "ar" ? t("titleRequired") : t("englishTitleRequired"));
      const checks: Array<[string, string, number]> = [
        [t("fieldTitle"), v.title.trim(), NOTICE_TITLE_MAX],
        [t("fieldBody"), v.body.trim(), NOTICE_BODY_MAX],
        [t("fieldArea"), v.area.trim(), NOTICE_AREA_MAX],
      ];
      for (const [field, text, max] of checks) {
        if (text.length > max) return fail(t("tooLong", { field, language: langName(l), max: num(max) }));
      }
      translations.push({ language: l, title: v.title.trim(), body: v.body.trim(), area: v.area.trim() });
    }
    if (!isNoticeCategory(fields.category)) return fail(t("categoryRequired"));
    if (!isNoticePriority(fields.priority)) return fail(t("priorityRequired"));
    if (!validity.ok) return fail(dateMessage(validity.error));
    return {
      translations,
      category: fields.category,
      priority: fields.priority,
      validFrom: validity.from,
      validUntil: validity.until,
    };
  }

  const dateMessage = (error: DateError) =>
    t(`dates.${error}`, {
      min: formatYear(NOTICE_YEAR_MIN, locale),
      max: formatYear(NOTICE_YEAR_MAX, locale),
      days: num(NOTICE_MAX_VALIDITY_DAYS),
    });

  function save() {
    const data = collect();
    if (!data) return;
    return run("save", async () => {
      if (notice) {
        apply(await updateNotice(notice.id, data, notice.version));
        setSuccess(t("savedOk"));
      } else {
        const created = await createNotice(data);
        apply(created);
        // The new notice gets its own address without remounting the form.
        window.history.replaceState(null, "", `/${locale}/admin/notices/${created.id}`);
        setSuccess(t("createdOk"));
      }
      focusStatus();
    });
  }

  function publish() {
    if (!notice) return;
    const data = dirty ? collect() : null;
    if (dirty && !data) return;
    return run("publish", async () => {
      // Save first when edited, then publish.
      let current = notice;
      if (data) {
        current = await updateNotice(current.id, data, current.version);
        apply(current);
      }
      adoptState(await publishNotice(current.id));
      setConfirm(null);
      setSuccess(t("publishedOk"));
      focusStatus();
    });
  }

  function unpublish() {
    if (!notice) return;
    return run("unpublish", async () => {
      adoptState(await unpublishNotice(notice.id));
      setConfirm(null);
      setSuccess(t("unpublishedOk"));
      focusStatus();
    });
  }

  function remove() {
    if (!notice) return;
    const title = noticeTitle(notice)?.text ?? "";
    return run("delete", async () => {
      await deleteNotice(notice.id);
      try {
        sessionStorage.setItem(NOTICE_DELETED_FLASH_KEY, title);
      } catch {
        // The confirmation on the list is optional.
      }
      dirtyRef.current = false;
      router.replace("/admin/notices");
    });
  }

  async function loadLatest() {
    if (!notice) return;
    setReloading(true);
    try {
      const latest = await getAdminNotice(notice.id);
      if (!latest) {
        setError(t("gone"));
        return;
      }
      apply(latest);
      setError(null);
      setSuccess(tf("latestLoadedOk"));
      focusStatus();
    } catch (e) {
      setError(describe(e));
    } finally {
      setReloading(false);
    }
  }

  const setText = (l: Lang, key: keyof Text, value: string) =>
    setValues((v) => ({ ...v, [l]: { ...v[l], [key]: value } }));
  const setField = <K extends keyof Fields>(key: K, value: Fields[K]) => setFields((f) => ({ ...f, [key]: value }));

  const backLink = (
    <Link href="/admin/notices" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
      {t("backToList")}
    </Link>
  );

  if (load === "loading") {
    return (
      <p role="status" className="text-ink/70">
        {t("loading")}
      </p>
    );
  }
  if (load === "error" || load === "notfound") {
    return (
      <div role="alert" className="max-w-prose">
        <p>{load === "error" ? t("loadError") : t("notFound")}</p>
        <div className="mt-3">{backLink}</div>
      </div>
    );
  }

  const stamp = (label: string, iso: string | null | undefined) =>
    iso ? (
      <div>
        <dt className="text-ink/70">{label}</dt>
        <dd>
          <time dateTime={iso}>{formatStamp(locale, iso)}</time>
        </dd>
      </div>
    ) : null;

  const status = notice ? noticeStatus(notice, now) : null;

  const counter = (l: Lang, key: keyof Text, max: number) => {
    const length = values[l][key].length;
    return (
      <p
        id={`${uid}-${key}count-${l}`}
        className={`mt-1 text-sm ${length > max ? "font-medium text-alert-danger" : "text-ink/70"}`}
      >
        {t("chars", { count: num(length), max: num(max) })}
      </p>
    );
  };

  const languageBlock = (l: Lang) => {
    const dir = l === "ar" ? "rtl" : "ltr";
    const v = values[l];
    return (
      <fieldset key={l} className="min-w-0 space-y-6 rounded-card border border-line p-5">
        <legend className="px-1 font-semibold">{l === "ar" ? t("arabic") : t("english")}</legend>
        <div>
          <label htmlFor={`${uid}-title-${l}`} className="block font-medium">
            {t("fieldTitle")}
            {l === "ar" && <span aria-hidden> *</span>}
          </label>
          <input
            id={`${uid}-title-${l}`}
            type="text"
            lang={l}
            dir={dir}
            required={l === "ar"}
            aria-required={l === "ar" || undefined}
            readOnly={readOnly}
            value={v.title}
            aria-invalid={v.title.length > NOTICE_TITLE_MAX || undefined}
            aria-describedby={`${uid}-titlecount-${l}`}
            onChange={(e) => setText(l, "title", e.target.value)}
            className={inputClass}
          />
          {counter(l, "title", NOTICE_TITLE_MAX)}
        </div>
        <div>
          <label htmlFor={`${uid}-area-${l}`} className="block font-medium">
            {t("fieldArea")}
          </label>
          <p id={`${uid}-areahint-${l}`} className="mt-1 text-sm text-ink/70">
            {t("areaHint")}
          </p>
          <input
            id={`${uid}-area-${l}`}
            type="text"
            lang={l}
            dir={dir}
            readOnly={readOnly}
            value={v.area}
            aria-invalid={v.area.length > NOTICE_AREA_MAX || undefined}
            aria-describedby={`${uid}-areahint-${l} ${uid}-areacount-${l}`}
            onChange={(e) => setText(l, "area", e.target.value)}
            className={inputClass}
          />
          {counter(l, "area", NOTICE_AREA_MAX)}
        </div>
        <div>
          <label htmlFor={`${uid}-body-${l}`} className="block font-medium">
            {t("fieldBody")}
          </label>
          <p id={`${uid}-bodyhint-${l}`} className="mt-1 text-sm text-ink/70">
            {t("bodyHint")}
          </p>
          <textarea
            id={`${uid}-body-${l}`}
            lang={l}
            dir={dir}
            rows={8}
            readOnly={readOnly}
            value={v.body}
            aria-invalid={v.body.length > NOTICE_BODY_MAX || undefined}
            aria-describedby={`${uid}-bodyhint-${l} ${uid}-bodycount-${l}`}
            onChange={(e) => setText(l, "body", e.target.value)}
            className="mt-2 block w-full rounded-control border border-ink/40 bg-paper px-3 py-2 leading-relaxed read-only:bg-stone aria-[invalid=true]:border-alert-danger"
          />
          {counter(l, "body", NOTICE_BODY_MAX)}
        </div>
      </fieldset>
    );
  };

  const dateInput = `${inputClass} max-w-xs`;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!readOnly && !waiting && !conflict) save();
      }}
      noValidate
      className="max-w-6xl"
    >
      <div className="mb-2">{backLink}</div>
      <h1 className="text-2xl font-bold md:text-3xl">{notice ? t("editTitle") : t("createTitle")}</h1>

      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <dt className="text-ink/70">{t("status")}</dt>
          <dd className="inline-flex items-center gap-2 font-medium">
            <span aria-hidden className={`size-2 shrink-0 rounded-full ${status ? STATUS_DOT[status] : "bg-ink/30"}`} />
            {status ? ts(`status.${status}`) : t("notSaved")}
          </dd>
        </div>
        {stamp(t("created"), notice?.createdAt)}
        {stamp(t("updated"), notice?.updatedAt)}
        {stamp(t("published"), notice?.publishedAt)}
      </dl>

      {/* Shown above the form while the priority is "urgent". */}
      <div aria-live="polite" className="empty:hidden">
        {urgent && (
          <div className="mt-6 max-w-prose border-s-4 border-alert-danger bg-stone px-4 py-3">
            <p className="font-semibold text-alert-danger">{t("urgentWarning")}</p>
            <p className="mt-1 text-sm">{published ? t("urgentWarningPublished") : t("urgentWarningDraft")}</p>
          </div>
        )}
      </div>

      {/* ---------- Category, priority, validity ---------- */}
      <fieldset className="mt-8 border-t border-line pt-6">
        <legend className="sr-only">{t("detailsTitle")}</legend>
        <h2 aria-hidden className="font-medium">
          {t("detailsTitle")}
        </h2>
        <p id={`${uid}-tz`} className="mt-1 max-w-prose text-sm text-ink/70">
          {t("timeZoneHint")}
        </p>

        <div className="mt-4 grid max-w-3xl gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-category`} className="block font-medium">
              {t("category")}
            </label>
            <select
              id={`${uid}-category`}
              value={fields.category}
              disabled={readOnly}
              onChange={(e) => setField("category", e.target.value)}
              className={inputClass}
            >
              <option value="">{t("choose")}</option>
              {NOTICE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {tn(`categories.${c}`)}
                </option>
              ))}
              {fields.category && !isNoticeCategory(fields.category) && (
                <option value={fields.category}>{fields.category}</option>
              )}
            </select>
          </div>
          <div>
            <label htmlFor={`${uid}-priority`} className="block font-medium">
              {t("priority")}
            </label>
            <select
              id={`${uid}-priority`}
              value={fields.priority}
              disabled={readOnly}
              onChange={(e) => setField("priority", e.target.value)}
              className={inputClass}
            >
              {NOTICE_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {tn(`priorities.${p}`)}
                </option>
              ))}
              {fields.priority && !isNoticePriority(fields.priority) && (
                <option value={fields.priority}>{fields.priority}</option>
              )}
            </select>
          </div>

          <div>
            <label htmlFor={`${uid}-from`} className="block font-medium">
              {t("validFrom")}
            </label>
            <input
              id={`${uid}-from`}
              type="datetime-local"
              dir="ltr"
              min={`${NOTICE_YEAR_MIN}-01-01T00:00`}
              max={`${NOTICE_YEAR_MAX}-12-31T23:59`}
              readOnly={readOnly}
              value={fields.validFrom}
              aria-invalid={(!validity.ok && validity.error === "fromInvalid") || undefined}
              aria-describedby={`${uid}-tz ${uid}-validity`}
              onChange={(e) => setField("validFrom", e.target.value)}
              className={dateInput}
            />
          </div>
          <div>
            <label htmlFor={`${uid}-until`} className="block font-medium">
              {t("validUntil")}
            </label>
            <input
              id={`${uid}-until`}
              type="datetime-local"
              dir="ltr"
              min={fields.validFrom || `${NOTICE_YEAR_MIN}-01-01T00:00`}
              max={`${NOTICE_YEAR_MAX}-12-31T23:59`}
              readOnly={readOnly}
              value={fields.validUntil}
              aria-invalid={(!validity.ok && validity.error !== "fromInvalid") || undefined}
              aria-describedby={`${uid}-tz ${uid}-validity${!validity.ok ? ` ${uid}-validity-error` : ""}`}
              onChange={(e) => setField("validUntil", e.target.value)}
              className={dateInput}
            />
          </div>
        </div>
        <p id={`${uid}-validity`} className="mt-3 max-w-prose text-sm text-ink/70">
          {t("validityHint", { days: num(NOTICE_MAX_VALIDITY_DAYS) })}
        </p>
        <div aria-live="polite" className="empty:hidden">
          {!validity.ok && (
            <p id={`${uid}-validity-error`} className="mt-2 max-w-prose text-sm font-medium text-alert-danger">
              {dateMessage(validity.error)}
            </p>
          )}
        </div>
      </fieldset>

      {/* ---------- Texts ---------- */}
      <div className="mt-8 border-t border-line pt-6">
        <p className="max-w-prose text-sm text-ink/70">{t("languagesHint")}</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">{NOTICE_LANGUAGES.map(languageBlock)}</div>
      </div>

      {/* ---------- Messages and actions ---------- */}
      <div className="mt-8 border-t border-line pt-6">
        <div ref={statusRef} tabIndex={-1} aria-live="polite" role="status" className="outline-none empty:hidden">
          {success && <p className="mb-4 font-medium text-pine">{success}</p>}
          {dirty && !success && !error && <p className="mb-4 text-sm text-ink/70">{tf("unsaved")}</p>}
        </div>
        {error && (
          <p role="alert" className="mb-4 border-s-4 border-alert-danger bg-stone px-4 py-3 text-alert-danger">
            <span className="sr-only">{tf("errorTitle")}: </span>
            {/* The API's own messages are in English: give them their own direction. */}
            <span dir="auto">{error}</span>
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
          cancel={t("cancel")}
          reloading={reloading}
          onLoadLatest={loadLatest}
        />

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy !== null || waiting || conflict} className={primaryButton}>
            {busy === "save" ? t("saving") : t("save")}
          </button>

          {notice && !published && confirm !== "publish" && (
            <button
              ref={publishBtnRef}
              type="button"
              onClick={() => setConfirm("publish")}
              disabled={busy !== null || waiting || conflict}
              className={outlineButton}
            >
              {t("publish")}
            </button>
          )}

          {notice && published && confirm !== "unpublish" && (
            <button
              ref={unpublishBtnRef}
              type="button"
              onClick={() => setConfirm("unpublish")}
              disabled={busy !== null || waiting}
              className={neutralButton}
            >
              {t("unpublish")}
            </button>
          )}

          {notice && published && (
            <Link
              href={`/notices/${notice.id}`}
              className="inline-flex min-h-11 items-center rounded-control border border-ink/40 bg-paper px-5 font-semibold"
            >
              {tf("viewPublic")}
            </Link>
          )}

          {notice && !published && confirm !== "delete" && (
            <button
              ref={deleteBtnRef}
              type="button"
              onClick={() => setConfirm("delete")}
              disabled={busy !== null || waiting}
              className={dangerOutlineButton}
            >
              {t("delete")}
            </button>
          )}
        </div>
        {notice && published && <p className="mt-3 text-sm text-ink/70">{t("deletePublishedHint")}</p>}

        {notice && !published && confirm === "publish" && (
          <ConfirmPanel
            label={t("publish")}
            message={`${dirty ? t("publishConfirmDirty") : t("publishConfirm")}${urgent ? ` ${t("publishConfirmUrgent")}` : ""}`}
            yesLabel={busy === "publish" ? t("publishing") : t("publishYes")}
            cancelLabel={t("cancel")}
            tone="neutral"
            busy={busy !== null}
            disabled={waiting || conflict}
            onYes={publish}
            onCancel={() => {
              setConfirm(null);
              focusLater(publishBtnRef);
            }}
          />
        )}
        {notice && published && confirm === "unpublish" && (
          <ConfirmPanel
            label={t("unpublish")}
            message={t("unpublishConfirm")}
            yesLabel={busy === "unpublish" ? t("unpublishing") : t("unpublishYes")}
            cancelLabel={t("cancel")}
            busy={busy !== null}
            disabled={waiting}
            onYes={unpublish}
            onCancel={() => {
              setConfirm(null);
              focusLater(unpublishBtnRef);
            }}
          />
        )}
        {notice && !published && confirm === "delete" && (
          <ConfirmPanel
            label={t("delete")}
            message={t("deleteConfirm", { title: noticeTitle(notice)?.text ?? ts("untitled") })}
            yesLabel={busy === "delete" ? t("deleting") : t("deleteYes")}
            cancelLabel={t("cancel")}
            busy={busy !== null}
            disabled={waiting}
            onYes={remove}
            onCancel={() => {
              setConfirm(null);
              focusLater(deleteBtnRef);
            }}
          />
        )}
      </div>
    </form>
  );
}
