"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatDate, formatNumber, formatYear } from "@/lib/numbers";
import { Markdown } from "@/components/Markdown";
import { NewsCover } from "@/components/NewsCover";
import {
  ENTRY_BODY_MAX,
  ENTRY_LANGUAGES,
  ENTRY_RULES,
  ENTRY_SUMMARY_MAX,
  ENTRY_TITLE_MAX,
  ENTRY_YEAR_MAX,
  ENTRY_YEAR_MIN,
  PROJECT_STATUSES,
  type EntryKind,
  type EntryLanguage,
} from "@/config/entries";
import { Link, useRouter } from "@/i18n/navigation";
import {
  AdminApiError,
  createEntry,
  deleteEntry,
  getAdminEntry,
  isPayloadTooLarge,
  publishEntry,
  removeEntryCover,
  unpublishEntry,
  updateEntry,
  uploadEntryCover,
  type AdminEntryDto,
  type EntryDetails,
  type EntryTranslationDto,
} from "@/lib/admin-api";
import { PHOTO_ACCEPT, PHOTO_ERROR_KEYS, prepareImage } from "@/lib/prepare-image";
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
import { contentHref, ENTRY_DELETED_FLASH_KEY, entryTitle } from "./ContentPanel";
import { useEntryLabels } from "./entry-labels";
import { isRateLimited, ProblemNotice } from "./ProblemNotice";

const BODY_WARN = Math.floor(ENTRY_BODY_MAX * 0.9);
const langs = ENTRY_LANGUAGES;
type Lang = EntryLanguage;
type Text = { title: string; summary: string; body: string };
type Values = Record<Lang, Text>;
// The kind-specific fields as typed in the form ("" = nothing chosen / empty).
type Fields = { category: string; status: string; year: string };
type Busy =
  | "save"
  | "publish"
  | "unpublish"
  | "prepare"
  | "upload"
  | "removeCover"
  | "delete"
  | null;
type Confirm = "publish" | "unpublish" | "removeCover" | "delete" | null;

const emptyText: Text = { title: "", summary: "", body: "" };
const emptyValues = (): Values => ({ ar: { ...emptyText }, en: { ...emptyText } });
const emptyFields: Fields = { category: "", status: "", year: "" };

const filled = (x: Text) => Boolean(x.title.trim() || x.summary.trim() || x.body.trim());
const snapshot = (values: Values, fields: Fields) => JSON.stringify({ values, fields });

function toValues(entry: AdminEntryDto): Values {
  const v = emptyValues();
  for (const tr of entry.translations) {
    if (tr.language in v) v[tr.language] = { title: tr.title, summary: tr.summary, body: tr.body ?? "" };
  }
  return v;
}

function toFields(entry: AdminEntryDto): Fields {
  return {
    category: entry.category ?? "",
    status: entry.status ?? "",
    year: entry.year === null ? "" : String(entry.year),
  };
}

// The editor of one entry. `id` edits an existing entry; without it, a new
// entry of `kind` is created by the first save (and the address becomes the
// entry's own).
export function EntryForm(props: { id: string; kind?: undefined } | { id?: undefined; kind: EntryKind }) {
  const t = useTranslations("Admin.entryForm");
  const tf = useTranslations("Admin.form");
  const tc = useTranslations("Admin.content");
  const tl = useTranslations("Admin.languages");
  const labels = useEntryLabels();
  const locale = useLocale();
  const num = (value: number) => formatNumber(value, locale);
  const router = useRouter();
  const uid = useId();

  const [load, setLoad] = useState<"loading" | "ready" | "error" | "notfound">(props.id ? "loading" : "ready");
  // null until the entry exists (the first save creates it).
  const [entry, setEntry] = useState<AdminEntryDto | null>(null);
  const [newKind] = useState<EntryKind | undefined>(props.kind);
  const kind: EntryKind | undefined = entry?.kind ?? newKind;
  const [values, setValues] = useState<Values>(emptyValues);
  const [fields, setFields] = useState<Fields>(emptyFields);
  const [baseline, setBaseline] = useState(() => snapshot(emptyValues(), emptyFields));
  const [tab, setTab] = useState<Lang>("ar");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rate, setRate] = useState<Problem | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  // Someone else saved this entry after it was loaded (the API answered 409).
  const [conflict, setConflict] = useState(false);
  const [reloading, setReloading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const publishBtnRef = useRef<HTMLButtonElement | null>(null);
  const unpublishBtnRef = useRef<HTMLButtonElement | null>(null);
  const removeCoverBtnRef = useRef<HTMLButtonElement | null>(null);
  const deleteBtnRef = useRef<HTMLButtonElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<Lang, HTMLButtonElement | null>>({ ar: null, en: null });
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
  const published = entry?.isPublished ?? false;

  // Adopt an entry the API returned: its fields AND its new version number, so
  // the next save is checked against the latest state, not the one loaded.
  function apply(dto: AdminEntryDto) {
    const v = toValues(dto);
    const f = toFields(dto);
    setConflict(false);
    setEntry(dto);
    setValues(v);
    setFields(f);
    setBaseline(snapshot(v, f));
  }

  // Adopt only the state and version (publish, cover...): whatever is typed in
  // the form and not saved yet stays as it is.
  function adoptState(dto: AdminEntryDto) {
    setEntry(dto);
  }

  useEffect(() => {
    if (!props.id) return;
    let cancelled = false;
    getAdminEntry(props.id).then(
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
  }, [props.id]);

  // Warn before leaving with unsaved changes: closing/reloading the tab, and
  // clicking any in-app link.
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

  // The server's own message whenever it gave one (business rules are 400s
  // with the reason), so nothing ever fails silently.
  function describe(e: unknown): string {
    if (isPayloadTooLarge(e)) return tf("photoUploadTooLarge");
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

  function fail(message: string, lang?: Lang) {
    setSuccess(null);
    setError(message);
    setConfirm(null);
    if (lang) setTab(lang);
    return null;
  }

  // Every language that has anything typed is sent (the languages sent become
  // the entry's languages); a language with all its fields empty is left out.
  // Returns null (with a message) when something must be fixed first.
  function collect(): { translations: EntryTranslationDto[]; details: EntryDetails } | null {
    if (!kind) return null;
    const rule = ENTRY_RULES[kind];
    const translations: EntryTranslationDto[] = [];
    for (const l of langs) {
      const v = values[l];
      if (!filled(v)) continue;
      if (!v.title.trim() || !v.summary.trim()) return fail(t("incomplete", { language: tl(l) }), l);
      if (v.body.length > ENTRY_BODY_MAX) {
        return fail(t("bodyTooLong", { language: tl(l), max: num(ENTRY_BODY_MAX) }), l);
      }
      translations.push({ language: l, title: v.title.trim(), summary: v.summary.trim(), body: v.body.trim() });
    }
    if (translations.length === 0) return fail(t("needContent"));

    let year: number | null = null;
    if (rule.usesYear && fields.year.trim() !== "") {
      year = Number(fields.year.trim());
      if (!Number.isInteger(year)) return fail(t("yearInvalid"));
    }
    // Category and status are checked by the API (its message is shown), so a
    // missing one is sent as null rather than blocked here.
    return {
      translations,
      details: {
        category: rule.categories.length > 0 ? fields.category || null : null,
        status: rule.usesStatus ? fields.status || null : null,
        year,
      },
    };
  }

  // A new entry gets its own address without remounting the form.
  function adoptCreated(created: AdminEntryDto) {
    apply(created);
    window.history.replaceState(null, "", `/${locale}/admin/content/${created.id}`);
  }

  function save() {
    const data = collect();
    if (!data || !kind) return;
    return run("save", async () => {
      if (entry) {
        apply(await updateEntry(entry.id, data.translations, data.details, entry.version));
        setSuccess(t("savedOk"));
      } else {
        adoptCreated(await createEntry(kind, data.translations, data.details));
        setSuccess(t("createdOk"));
      }
      focusStatus();
    });
  }

  function publish() {
    if (!entry) return;
    const data = dirty ? collect() : null;
    if (dirty && !data) return;
    return run("publish", async () => {
      // Save first when edited, then publish.
      let current = entry;
      if (data) {
        current = await updateEntry(current.id, data.translations, data.details, current.version);
        apply(current);
      }
      adoptState(await publishEntry(current.id));
      setConfirm(null);
      setSuccess(t("publishedOk"));
      focusStatus();
    });
  }

  function unpublish() {
    if (!entry) return;
    return run("unpublish", async () => {
      adoptState(await unpublishEntry(entry.id));
      setConfirm(null);
      setSuccess(t("unpublishedOk"));
      focusStatus();
    });
  }

  function remove() {
    if (!entry || !kind) return;
    const title = entryTitle(entry)?.text ?? "";
    return run("delete", async () => {
      await deleteEntry(entry.id);
      try {
        sessionStorage.setItem(ENTRY_DELETED_FLASH_KEY, title);
      } catch {
        // The confirmation on the list is optional.
      }
      dirtyRef.current = false; // do not warn about the navigation we trigger
      router.replace(contentHref(kind));
    });
  }

  // Checked, scaled down and re-encoded first (see prepareImage).
  async function onCoverPicked(picked: File | undefined) {
    if (fileRef.current) fileRef.current.value = ""; // allow picking the same file again
    if (!picked || !entry) return;
    setBusy("prepare");
    setError(null);
    setRate(null);
    setSuccess(null);
    const prepared = await prepareImage(picked);
    setBusy(null);
    if (!prepared.ok) return fail(tf(PHOTO_ERROR_KEYS[prepared.reason]));
    const file = prepared.file;
    return run("upload", async () => {
      adoptState(await uploadEntryCover(entry.id, file));
      setSuccess(tf("coverUploadedOk"));
      focusStatus();
    });
  }

  function removeCover() {
    if (!entry) return;
    return run("removeCover", async () => {
      adoptState(await removeEntryCover(entry.id));
      setConfirm(null);
      setSuccess(tf("coverRemovedOk"));
      focusStatus();
    });
  }

  async function loadLatest() {
    if (!entry) return;
    setReloading(true);
    try {
      const latest = await getAdminEntry(entry.id);
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

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>) {
    let next: Lang | null = null;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") next = tab === "ar" ? "en" : "ar";
    else if (e.key === "Home") next = "ar";
    else if (e.key === "End") next = "en";
    if (!next) return;
    e.preventDefault();
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  const setText = (l: Lang, key: keyof Text, value: string) =>
    setValues((v) => ({ ...v, [l]: { ...v[l], [key]: value } }));
  const setField = (key: keyof Fields, value: string) => setFields((f) => ({ ...f, [key]: value }));

  const backLink = (
    <Link
      href={kind ? contentHref(kind) : "/admin/content"}
      className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
    >
      {kind ? t("backToList", { kind: tc(`kinds.${kind}`) }) : t("backToContent")}
    </Link>
  );

  if (load === "loading") {
    return (
      <p role="status" className="text-ink/70">
        {t("loading")}
      </p>
    );
  }
  if (load === "error" || load === "notfound" || !kind) {
    return (
      <div role="alert" className="max-w-prose">
        <p>{load === "error" ? t("loadError") : t("notFound")}</p>
        <div className="mt-3">{backLink}</div>
      </div>
    );
  }

  const rule = ENTRY_RULES[kind];
  const categories = rule.categories as readonly string[];

  const dateRow = (label: string, iso: string | null | undefined) =>
    iso ? (
      <div>
        <dt className="text-ink/70">{label}</dt>
        <dd>
          <time dateTime={iso}>
            {formatDate(iso, locale, { dateStyle: "medium", timeStyle: "short" })}
          </time>
        </dd>
      </div>
    ) : null;

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
      <h1 className="text-2xl font-bold md:text-3xl">
        {entry ? t(`editTitle.${kind}`) : t(`createTitle.${kind}`)}
      </h1>

      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <dt className="text-ink/70">{t("status")}</dt>
          <dd className="inline-flex items-center gap-2 font-medium">
            <span
              aria-hidden
              className={`size-2 shrink-0 rounded-full ${
                !entry ? "bg-ink/30" : published ? "bg-pine" : "bg-alert-warn"
              }`}
            />
            {!entry ? t("notSaved") : published ? tc("published") : tc("draft")}
          </dd>
        </div>
        {dateRow(t("created"), entry?.createdAt)}
        {dateRow(t("updated"), entry?.updatedAt)}
        {dateRow(t("published"), entry?.publishedAt)}
      </dl>

      {/* ---------- Cover photo ---------- */}
      <section aria-labelledby={`${uid}-cover-title`} className="mt-8 border-t border-line pt-6">
        <h2 id={`${uid}-cover-title`} className="font-medium">
          {t("coverTitle")}
        </h2>
        <div className="mt-3 grid max-w-xl gap-4">
          <div className="relative aspect-[3/2] overflow-hidden rounded-card bg-stone">
            {entry?.coverImageUrl ? (
              <NewsCover
                coverImageUrl={entry.coverImageUrl}
                title={tf("coverPreviewAlt")}
                sizes="(min-width: 768px) 36rem, 100vw"
              />
            ) : (
              <p className="absolute inset-0 grid place-items-center px-4 text-center text-sm text-ink/70">
                {t("coverNone")}
              </p>
            )}
            {(busy === "prepare" || busy === "upload" || busy === "removeCover") && (
              <p role="status" className="absolute inset-0 grid place-items-center bg-paper/80 font-medium">
                {busy === "prepare"
                  ? tf("photoPreparing")
                  : busy === "upload"
                    ? tf("coverUploading")
                    : tf("coverRemoving")}
              </p>
            )}
          </div>
          <p id={`${uid}-cover-hint`} className={`text-sm ${entry ? "text-ink/70" : "font-medium text-ink"}`}>
            {entry ? tf("coverHint") : t("coverSaveFirst")}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept={PHOTO_ACCEPT}
            hidden
            tabIndex={-1}
            onChange={(e) => void onCoverPicked(e.target.files?.[0])}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!entry || busy !== null || waiting}
              aria-describedby={`${uid}-cover-hint`}
              onClick={() => fileRef.current?.click()}
              className={outlineButton}
            >
              {entry?.coverImageUrl ? t("coverReplace") : t("coverChoose")}
            </button>
            {entry?.coverImageUrl && confirm !== "removeCover" && (
              <button
                ref={removeCoverBtnRef}
                type="button"
                disabled={busy !== null || waiting}
                onClick={() => setConfirm("removeCover")}
                className={dangerOutlineButton}
              >
                {t("coverRemove")}
              </button>
            )}
          </div>
          {entry?.coverImageUrl && confirm === "removeCover" && (
            <ConfirmPanel
              label={t("coverRemove")}
              message={t("coverRemoveConfirm")}
              yesLabel={busy === "removeCover" ? tf("coverRemoving") : tf("coverRemoveYes")}
              cancelLabel={t("cancel")}
              busy={busy !== null}
              disabled={waiting}
              onYes={removeCover}
              onCancel={() => {
                setConfirm(null);
                focusLater(removeCoverBtnRef);
              }}
            />
          )}
        </div>
      </section>

      {/* ---------- Fields that depend on the kind (src/config/entries.ts) ---------- */}
      {(categories.length > 0 || rule.usesStatus || rule.usesYear) && (
        <fieldset className="mt-8 border-t border-line pt-6">
          <legend className="sr-only">{t("detailsTitle")}</legend>
          <h2 aria-hidden className="font-medium">
            {t("detailsTitle")}
          </h2>
          <div className="mt-3 grid max-w-3xl gap-6 sm:grid-cols-3">
            {kind !== "history" && (
              <div>
                <label htmlFor={`${uid}-category`} className="block font-medium">
                  {labels.categoryHeading(kind)}
                </label>
                <select
                  id={`${uid}-category`}
                  value={fields.category}
                  disabled={readOnly}
                  aria-describedby={`${uid}-required`}
                  onChange={(e) => setField("category", e.target.value)}
                  className={inputClass}
                >
                  <option value="">{t("choose")}</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {labels.category(kind, c)}
                    </option>
                  ))}
                  {/* A code this screen does not know (should not happen): keep it visible. */}
                  {fields.category && !categories.includes(fields.category) && (
                    <option value={fields.category}>{fields.category}</option>
                  )}
                </select>
              </div>
            )}
            {rule.usesStatus && (
              <div>
                <label htmlFor={`${uid}-status`} className="block font-medium">
                  {labels.statusHeading}
                </label>
                <select
                  id={`${uid}-status`}
                  value={fields.status}
                  disabled={readOnly}
                  aria-describedby={`${uid}-required`}
                  onChange={(e) => setField("status", e.target.value)}
                  className={inputClass}
                >
                  <option value="">{t("choose")}</option>
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {labels.status(s)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {rule.usesYear && (
              <div>
                <label htmlFor={`${uid}-year`} className="block font-medium">
                  {labels.yearHeading}
                </label>
                <input
                  id={`${uid}-year`}
                  type="number"
                  inputMode="numeric"
                  dir="ltr"
                  min={ENTRY_YEAR_MIN}
                  max={ENTRY_YEAR_MAX}
                  step={1}
                  readOnly={readOnly}
                  value={fields.year}
                  aria-describedby={`${uid}-year-hint`}
                  onChange={(e) => setField("year", e.target.value)}
                  className={inputClass}
                />
                <p id={`${uid}-year-hint`} className="mt-1 text-sm text-ink/70">
                  {t("yearHint", { min: formatYear(ENTRY_YEAR_MIN, locale), max: formatYear(ENTRY_YEAR_MAX, locale) })}
                </p>
              </div>
            )}
          </div>
          {kind !== "history" && (
            <p id={`${uid}-required`} className="mt-2 text-sm text-ink/70">
              {t(rule.usesStatus ? "requiredBoth" : "requiredCategory", {
                field: labels.categoryHeading(kind),
              })}
            </p>
          )}
        </fieldset>
      )}

      {/* ---------- Texts, one tab per language ---------- */}
      <div role="tablist" aria-label={t("languagesLabel")} className="mt-8 flex gap-1 border-b border-line">
        {langs.map((l) => {
          const selected = tab === l;
          const has = filled(values[l]);
          return (
            <button
              key={l}
              ref={(el) => {
                tabRefs.current[l] = el;
              }}
              type="button"
              role="tab"
              id={`${uid}-tab-${l}`}
              aria-selected={selected}
              aria-controls={`${uid}-panel-${l}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(l)}
              onKeyDown={onTabKey}
              className={`-mb-px min-h-11 border-b-2 px-4 font-medium ${
                selected ? "border-pine text-pine" : "border-transparent hover:text-pine"
              }`}
            >
              {tl(l)}
              {has ? <span className="sr-only"> ({tf("tabHint")})</span> : null}
              {has ? <span aria-hidden className="ms-2 inline-block size-1.5 rounded-full bg-gold" /> : null}
            </button>
          );
        })}
      </div>
      <p className="mt-3 max-w-prose text-sm text-ink/70">{t("languagesHint")}</p>

      {langs.map((l) => {
        const v = values[l];
        const bodyLen = v.body.length;
        const dir = l === "ar" ? "rtl" : "ltr";
        return (
          <div
            key={l}
            role="tabpanel"
            id={`${uid}-panel-${l}`}
            aria-labelledby={`${uid}-tab-${l}`}
            hidden={tab !== l}
            className="mt-6 grid gap-8 lg:grid-cols-2"
          >
            <div className="min-w-0 space-y-6">
              <div>
                <label htmlFor={`${uid}-title-${l}`} className="block font-medium">
                  {t("fieldTitle")}
                </label>
                <input
                  id={`${uid}-title-${l}`}
                  type="text"
                  lang={l}
                  dir={dir}
                  maxLength={ENTRY_TITLE_MAX}
                  readOnly={readOnly}
                  value={v.title}
                  aria-describedby={`${uid}-count-${l}`}
                  onChange={(e) => setText(l, "title", e.target.value)}
                  className={inputClass}
                />
                <p id={`${uid}-count-${l}`} className="mt-1 text-sm text-ink/70">
                  {t("chars", { count: num(v.title.length), max: num(ENTRY_TITLE_MAX) })}
                </p>
              </div>
              <div>
                <label htmlFor={`${uid}-summary-${l}`} className="block font-medium">
                  {t("fieldSummary")}
                </label>
                <p id={`${uid}-sumhint-${l}`} className="mt-1 text-sm text-ink/70">
                  {t("summaryHint")}
                </p>
                <textarea
                  id={`${uid}-summary-${l}`}
                  lang={l}
                  dir={dir}
                  rows={3}
                  maxLength={ENTRY_SUMMARY_MAX}
                  readOnly={readOnly}
                  value={v.summary}
                  aria-describedby={`${uid}-sumhint-${l} ${uid}-sumcount-${l}`}
                  onChange={(e) => setText(l, "summary", e.target.value)}
                  className="mt-2 block w-full rounded-control border border-ink/40 bg-paper px-3 py-2 leading-relaxed read-only:bg-stone"
                />
                <p id={`${uid}-sumcount-${l}`} className="mt-1 text-sm text-ink/70">
                  {t("chars", { count: num(v.summary.length), max: num(ENTRY_SUMMARY_MAX) })}
                </p>
              </div>
              <div>
                <label htmlFor={`${uid}-body-${l}`} className="block font-medium">
                  {t("fieldBody")}
                </label>
                <p id={`${uid}-md-${l}`} className="mt-1 text-sm text-ink/70">
                  {t("markdownHint")}
                </p>
                <textarea
                  id={`${uid}-body-${l}`}
                  lang={l}
                  dir={dir}
                  rows={14}
                  readOnly={readOnly}
                  value={v.body}
                  aria-describedby={`${uid}-md-${l} ${uid}-bodycount-${l}`}
                  aria-invalid={bodyLen > ENTRY_BODY_MAX || undefined}
                  onChange={(e) => setText(l, "body", e.target.value)}
                  className="mt-2 block w-full rounded-control border border-ink/40 bg-paper px-3 py-2 leading-relaxed read-only:bg-stone aria-[invalid=true]:border-alert-danger"
                />
                {/* The counter is not a live region (it would chatter on every
                    key); the warning below it is, and changes only at the limits. */}
                <p
                  id={`${uid}-bodycount-${l}`}
                  className={`mt-1 text-sm ${
                    bodyLen > ENTRY_BODY_MAX
                      ? "font-medium text-alert-danger"
                      : bodyLen >= BODY_WARN
                        ? "font-semibold text-ink"
                        : "text-ink/70"
                  }`}
                >
                  {t("chars", { count: num(bodyLen), max: num(ENTRY_BODY_MAX) })}
                </p>
                <div aria-live="polite" className="empty:hidden">
                  {bodyLen > ENTRY_BODY_MAX ? (
                    <p className="mt-1 text-sm font-medium text-alert-danger">{t("bodyOver")}</p>
                  ) : bodyLen >= BODY_WARN ? (
                    <p className="mt-1 text-sm text-ink/80">{t("bodyNear")}</p>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Same safe renderer as the public page: nothing runs here either. */}
            <section aria-labelledby={`${uid}-preview-${l}`} className="min-w-0">
              <h2 id={`${uid}-preview-${l}`} className="font-medium">
                {t("preview")}
              </h2>
              <div lang={l} dir={dir} className="mt-1 min-h-40 rounded-card border border-line bg-paper p-5">
                {filled(v) ? (
                  <>
                    {v.title.trim() && <p className="text-2xl leading-tight font-bold break-words">{v.title}</p>}
                    {v.summary.trim() && <p className="mt-3 text-lg break-words text-ink/80">{v.summary}</p>}
                    <Markdown className="mt-5">{v.body}</Markdown>
                  </>
                ) : (
                  <p className="text-ink/60">{t("previewEmpty")}</p>
                )}
              </div>
            </section>
          </div>
        );
      })}

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

          {entry && !published && confirm !== "publish" && (
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

          {entry && published && confirm !== "unpublish" && (
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

          {entry && published && (
            <Link
              href={`/entries/${entry.id}`}
              className="inline-flex min-h-11 items-center rounded-control border border-ink/40 bg-paper px-5 font-semibold"
            >
              {tf("viewPublic")}
            </Link>
          )}

          {entry && !published && confirm !== "delete" && (
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
        {entry && published && <p className="mt-3 text-sm text-ink/70">{t("deletePublishedHint")}</p>}

        {entry && !published && confirm === "publish" && (
          <ConfirmPanel
            label={t("publish")}
            message={dirty ? t("publishConfirmDirty") : t("publishConfirm")}
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
        {entry && published && confirm === "unpublish" && (
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
        {entry && !published && confirm === "delete" && (
          <ConfirmPanel
            label={t("delete")}
            message={t("deleteConfirm", { title: entryTitle(entry)?.text ?? tc("untitled") })}
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
