"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Markdown } from "@/components/Markdown";
import { NewsCover } from "@/components/NewsCover";
import { Link } from "@/i18n/navigation";
import {
  AdminApiError,
  COVER_MAX_BYTES,
  COVER_TYPES,
  createPage,
  getAdminPage,
  PAGE_BODY_MAX,
  PAGE_KEYS,
  PAGE_TITLE_MAX,
  publishPage,
  removePageCover,
  unpublishPage,
  updatePage,
  uploadPageCover,
  type AdminPageDto,
  type PageKey,
  type TranslationDto,
} from "@/lib/admin-api";
import { rateProblem, type Problem } from "@/lib/problem";
import {
  ConfirmPanel,
  ConflictNotice,
  dangerOutlineButton,
  focusLater,
  inputClass,
  outlineButton,
  primaryButton,
} from "./AdminControls";
import { isRateLimited, ProblemNotice } from "./ProblemNotice";

const BODY_WARN = Math.floor(PAGE_BODY_MAX * 0.9);
const langs = ["ar", "en"] as const;
type Lang = (typeof langs)[number];
type Values = Record<Lang, { title: string; body: string }>;
type Busy = "save" | "publish" | "unpublish" | "upload" | "removeCover" | null;
type Confirm = "publish" | "unpublish" | "removeCover" | null;

const empty: Values = { ar: { title: "", body: "" }, en: { title: "", body: "" } };

function toValues(page: AdminPageDto): Values {
  const v: Values = { ar: { ...empty.ar }, en: { ...empty.en } };
  for (const tr of page.translations) v[tr.language] = { title: tr.title, body: tr.body };
  return v;
}

// Only translations with both a title and a body are sent.
function toTranslations(values: Values): TranslationDto[] {
  return langs
    .filter((l) => values[l].title.trim() && values[l].body.trim())
    .map((l) => ({ language: l, title: values[l].title.trim(), body: values[l].body.trim() }));
}

export function PageForm({ pageKey }: { pageKey: string }) {
  const key = PAGE_KEYS.find((k) => k === pageKey);
  const t = useTranslations("Admin.pageForm");
  if (!key) {
    return (
      <div role="alert" className="max-w-prose">
        <p>{t("notFound")}</p>
        <Link
          href="/admin/pages"
          className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
        >
          {t("backToList")}
        </Link>
      </div>
    );
  }
  return <Editor pageKey={key} />;
}

function Editor({ pageKey }: { pageKey: PageKey }) {
  const t = useTranslations("Admin.pageForm");
  const tf = useTranslations("Admin.form");
  const tp = useTranslations("Admin.pages");
  const tl = useTranslations("Admin.languages");
  const tn = useTranslations("Nav");
  const format = useFormatter();
  const uid = useId();
  const pageName = tn(pageKey);

  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  // null until the page has been created (the first save creates it).
  const [page, setPage] = useState<AdminPageDto | null>(null);
  const [values, setValues] = useState<Values>(empty);
  const [baseline, setBaseline] = useState(JSON.stringify(empty));
  const [tab, setTab] = useState<Lang>("ar");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rate, setRate] = useState<Problem | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  // Someone else saved this page after it was loaded (the API answered 409).
  const [conflict, setConflict] = useState(false);
  const [reloading, setReloading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const publishBtnRef = useRef<HTMLButtonElement | null>(null);
  const unpublishBtnRef = useRef<HTMLButtonElement | null>(null);
  const removeCoverBtnRef = useRef<HTMLButtonElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<Lang, HTMLButtonElement | null>>({ ar: null, en: null });
  // The status message only becomes focusable after the render that shows it.
  const [statusFocus, setStatusFocus] = useState(0);
  const focusStatus = () => setStatusFocus((n) => n + 1);
  useEffect(() => {
    if (statusFocus > 0) statusRef.current?.focus();
  }, [statusFocus]);

  const dirty = JSON.stringify(values) !== baseline;
  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const waiting = isRateLimited(rate);
  const readOnly = busy !== null;
  const published = page?.isPublished ?? false;

  // Adopt a page the API returned: its fields AND its new version number, so
  // the next save is checked against the latest state, not the one loaded.
  function apply(dto: AdminPageDto) {
    const v = toValues(dto);
    setConflict(false);
    setPage(dto);
    setValues(v);
    setBaseline(JSON.stringify(v));
  }

  useEffect(() => {
    let cancelled = false;
    getAdminPage(pageKey).then(
      (dto) => {
        if (cancelled) return;
        if (dto) apply(dto);
        setLoad("ready");
      },
      () => !cancelled && setLoad("error"),
    );
    return () => {
      cancelled = true;
    };
  }, [pageKey]);

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

  function describe(e: unknown): string {
    if (e instanceof AdminApiError) return e.detail ?? tf("apiError", { status: e.status });
    return tf("networkError");
  }

  async function run(kind: Exclude<Busy, null>, action: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    setRate(null);
    setSuccess(null);
    try {
      await action();
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 429) setRate(rateProblem(e.retryAfter));
      else if (e instanceof AdminApiError && e.status === 409) {
        // Keep everything the person typed; offer to load the saved version.
        setConflict(true);
        setConfirm(null);
      } else setError(describe(e));
    } finally {
      setBusy(null);
    }
  }

  // A text over the limit blocks saving (the API would answer 400 anyway).
  function bodyTooLong(): boolean {
    const over = langs.find((l) => values[l].body.length > PAGE_BODY_MAX);
    if (!over) return false;
    setSuccess(null);
    setError(t("bodyTooLong", { language: tl(over), max: PAGE_BODY_MAX }));
    setTab(over);
    return true;
  }

  async function loadLatest() {
    setReloading(true);
    try {
      const latest = await getAdminPage(pageKey);
      if (latest) apply(latest);
      setError(null);
      setSuccess(tf("latestLoadedOk"));
      focusStatus();
    } catch (e) {
      setError(describe(e));
    } finally {
      setReloading(false);
    }
  }

  function save() {
    const translations = toTranslations(values);
    if (translations.length === 0) return setError(t("needContent"));
    if (bodyTooLong()) return;
    return run("save", async () => {
      if (page) {
        apply(await updatePage(pageKey, translations, page.version));
        setSuccess(t("savedOk"));
      } else {
        apply(await createPage(pageKey, translations));
        setSuccess(t("createdOk"));
      }
    });
  }

  function publish() {
    const translations = toTranslations(values);
    if (!translations.some((x) => x.language === "ar")) {
      setConfirm(null);
      return setError(t("needArabic"));
    }
    if (bodyTooLong()) return setConfirm(null);
    return run("publish", async () => {
      // Save first (create, or update when edited), then publish.
      if (!page) apply(await createPage(pageKey, translations));
      else if (dirty) apply(await updatePage(pageKey, translations, page.version));
      apply(await publishPage(pageKey));
      setConfirm(null);
      setSuccess(t("publishedOk"));
      focusStatus();
    });
  }

  function unpublish() {
    return run("unpublish", async () => {
      // Unpublishing keeps the text; adopt only the new state and version, so
      // anything typed since the last save stays in the form.
      setPage(await unpublishPage(pageKey));
      setConfirm(null);
      setSuccess(t("unpublishedOk"));
      focusStatus();
    });
  }

  function onCoverPicked(file: File | undefined) {
    if (fileRef.current) fileRef.current.value = ""; // allow picking the same file again
    if (!file) return;
    if (!(COVER_TYPES as readonly string[]).includes(file.type)) {
      setSuccess(null);
      return setError(tf("coverTypeError"));
    }
    if (file.size > COVER_MAX_BYTES) {
      setSuccess(null);
      return setError(tf("coverSizeError", { max: COVER_MAX_BYTES / (1024 * 1024) }));
    }
    if (page) {
      return run("upload", async () => {
        // Only the cover changes: keep whatever is typed in the form.
        setPage(await uploadPageCover(pageKey, file));
        setSuccess(tf("coverUploadedOk"));
      });
    }
    // Not created yet: a cover needs a saved page, so save it first.
    const translations = toTranslations(values);
    if (translations.length === 0) {
      setSuccess(null);
      return setError(t("coverNeedContent"));
    }
    if (bodyTooLong()) return;
    return run("upload", async () => {
      const created = await createPage(pageKey, translations);
      apply(created);
      setPage(await uploadPageCover(pageKey, file));
      setSuccess(tf("coverUploadedOk"));
    });
  }

  function removeCover() {
    return run("removeCover", async () => {
      setPage(await removePageCover(pageKey));
      setConfirm(null);
      setSuccess(tf("coverRemovedOk"));
      focusStatus();
    });
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

  const backLink = (
    <Link
      href="/admin/pages"
      className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
    >
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
  if (load === "error") {
    return (
      <div role="alert" className="max-w-prose">
        <p>{t("loadError")}</p>
        <div className="mt-3">{backLink}</div>
      </div>
    );
  }

  const dateRow = (label: string, iso: string | null | undefined) =>
    iso ? (
      <div>
        <dt className="text-ink/70">{label}</dt>
        <dd>
          <time dateTime={iso}>
            {format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" })}
          </time>
        </dd>
      </div>
    ) : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!readOnly && !waiting) save();
      }}
      noValidate
      className="max-w-6xl"
    >
      <div className="mb-2">{backLink}</div>
      <h1 className="text-2xl font-bold md:text-3xl">
        {page ? t("editTitle", { page: pageName }) : t("createTitle", { page: pageName })}
      </h1>

      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <dt className="text-ink/70">{t("status")}</dt>
          <dd className="inline-flex items-center gap-2 font-medium">
            <span
              aria-hidden
              className={`size-2 shrink-0 rounded-full ${
                !page ? "bg-ink/30" : published ? "bg-cedar" : "bg-alert-warn"
              }`}
            />
            {!page ? tp("notCreated") : published ? tp("published") : tp("draft")}
          </dd>
        </div>
        {dateRow(t("created"), page?.createdAt)}
        {dateRow(t("updated"), page?.updatedAt)}
        {dateRow(t("published"), page?.publishedAt)}
      </dl>

      <section aria-labelledby={`${uid}-cover-title`} className="mt-8 border-t border-hairline pt-6">
        <h2 id={`${uid}-cover-title`} className="font-medium">
          {tf("coverTitle")}
        </h2>
        <div className="mt-3 grid max-w-xl gap-4">
          <div className="relative aspect-[3/2] overflow-hidden rounded-card bg-sand">
            {page?.coverImageUrl ? (
              <NewsCover
                coverImageUrl={page.coverImageUrl}
                title={tf("coverPreviewAlt")}
                sizes="(min-width: 768px) 36rem, 100vw"
              />
            ) : (
              <p className="absolute inset-0 grid place-items-center px-4 text-center text-sm text-ink/70">
                {tf("coverNone")}
              </p>
            )}
            {(busy === "upload" || busy === "removeCover") && (
              <p role="status" className="absolute inset-0 grid place-items-center bg-ivory/80 font-medium">
                {busy === "upload" ? tf("coverUploading") : tf("coverRemoving")}
              </p>
            )}
          </div>
          <p id={`${uid}-cover-hint`} className="text-sm text-ink/70">
            {page ? tf("coverHint") : t("coverHintNew")}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept={COVER_TYPES.join(",")}
            hidden
            tabIndex={-1}
            onChange={(e) => onCoverPicked(e.target.files?.[0])}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy !== null || waiting}
              aria-describedby={`${uid}-cover-hint`}
              onClick={() => fileRef.current?.click()}
              className={outlineButton}
            >
              {page?.coverImageUrl ? tf("coverReplace") : tf("coverChoose")}
            </button>
            {page?.coverImageUrl && confirm !== "removeCover" && (
              <button
                ref={removeCoverBtnRef}
                type="button"
                disabled={busy !== null || waiting}
                onClick={() => setConfirm("removeCover")}
                className={dangerOutlineButton}
              >
                {tf("coverRemove")}
              </button>
            )}
          </div>
          {page?.coverImageUrl && confirm === "removeCover" && (
            <ConfirmPanel
              label={tf("coverRemove")}
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

      <div role="tablist" aria-label={tf("languagesLabel")} className="mt-8 flex gap-1 border-b border-hairline">
        {langs.map((l) => {
          const selected = tab === l;
          const filled = values[l].title.trim() && values[l].body.trim();
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
                selected ? "border-cedar text-cedar" : "border-transparent hover:text-cedar"
              }`}
            >
              {tl(l)}
              {filled ? <span className="sr-only"> ({tf("tabHint")})</span> : null}
              {filled ? <span aria-hidden className="ms-2 inline-block size-1.5 rounded-full bg-gold" /> : null}
            </button>
          );
        })}
      </div>

      {langs.map((l) => {
        const bodyLen = values[l].body.length;
        return (
          <div
            key={l}
            role="tabpanel"
            id={`${uid}-panel-${l}`}
            aria-labelledby={`${uid}-tab-${l}`}
            hidden={tab !== l}
            className="mt-6 grid gap-8 lg:grid-cols-2"
          >
            <div className="space-y-6">
              <div>
                <label htmlFor={`${uid}-title-${l}`} className="block font-medium">
                  {t("fieldTitle")}
                </label>
                <input
                  id={`${uid}-title-${l}`}
                  type="text"
                  lang={l}
                  dir={l === "ar" ? "rtl" : "ltr"}
                  maxLength={PAGE_TITLE_MAX}
                  readOnly={readOnly}
                  value={values[l].title}
                  aria-describedby={`${uid}-count-${l}`}
                  onChange={(e) => setValues((v) => ({ ...v, [l]: { ...v[l], title: e.target.value } }))}
                  className={inputClass}
                />
                <p id={`${uid}-count-${l}`} className="mt-1 text-sm text-ink/70">
                  {t("chars", { count: values[l].title.length, max: PAGE_TITLE_MAX })}
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
                  dir={l === "ar" ? "rtl" : "ltr"}
                  rows={16}
                  readOnly={readOnly}
                  value={values[l].body}
                  aria-describedby={`${uid}-md-${l} ${uid}-bodycount-${l}`}
                  aria-invalid={bodyLen > PAGE_BODY_MAX || undefined}
                  onChange={(e) => setValues((v) => ({ ...v, [l]: { ...v[l], body: e.target.value } }))}
                  className="mt-2 block w-full rounded-control border border-ink/40 bg-ivory px-3 py-2 leading-relaxed read-only:bg-sand aria-[invalid=true]:border-alert-danger"
                />
                {/* The counter is not a live region (it would chatter on every
                    key); the warning below it is, and changes only at the limits. */}
                <p
                  id={`${uid}-bodycount-${l}`}
                  className={`mt-1 text-sm ${
                    bodyLen > PAGE_BODY_MAX
                      ? "font-medium text-alert-danger"
                      : bodyLen >= BODY_WARN
                        ? "font-semibold text-ink"
                        : "text-ink/70"
                  }`}
                >
                  {t("chars", { count: bodyLen, max: PAGE_BODY_MAX })}
                </p>
                <div aria-live="polite" className="empty:hidden">
                  {bodyLen > PAGE_BODY_MAX ? (
                    <p className="mt-1 text-sm font-medium text-alert-danger">{t("bodyOver")}</p>
                  ) : bodyLen >= BODY_WARN ? (
                    <p className="mt-1 text-sm text-ink/80">{t("bodyNear")}</p>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Same safe renderer as the public page: nothing runs here either. */}
            <section aria-labelledby={`${uid}-preview-${l}`}>
              <h2 id={`${uid}-preview-${l}`} className="font-medium">
                {t("preview")}
              </h2>
              <div
                lang={l}
                dir={l === "ar" ? "rtl" : "ltr"}
                className="mt-1 min-h-40 rounded-card border border-hairline bg-ivory p-5"
              >
                {values[l].title.trim() || values[l].body.trim() ? (
                  <>
                    {values[l].title.trim() && (
                      <p className="text-2xl leading-tight font-bold break-words">{values[l].title}</p>
                    )}
                    <Markdown className="mt-5">{values[l].body}</Markdown>
                  </>
                ) : (
                  <p className="text-ink/60">{t("previewEmpty")}</p>
                )}
              </div>
            </section>
          </div>
        );
      })}

      <div className="mt-8 border-t border-hairline pt-6">
        <div ref={statusRef} tabIndex={-1} aria-live="polite" role="status" className="outline-none empty:hidden">
          {success && <p className="mb-4 font-medium text-cedar">{success}</p>}
          {dirty && !success && !error && <p className="mb-4 text-sm text-ink/70">{tf("unsaved")}</p>}
        </div>
        {error && (
          <p role="alert" className="mb-4 border-s-4 border-alert-danger bg-sand px-4 py-3 text-alert-danger">
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
          cancel={t("cancel")}
          reloading={reloading}
          onLoadLatest={loadLatest}
        />

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy !== null || waiting || conflict} className={primaryButton}>
            {busy === "save" ? t("saving") : t("save")}
          </button>

          {!published && confirm !== "publish" && (
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

          {published && confirm !== "unpublish" && (
            <button
              ref={unpublishBtnRef}
              type="button"
              onClick={() => setConfirm("unpublish")}
              disabled={busy !== null || waiting}
              className={dangerOutlineButton}
            >
              {t("unpublish")}
            </button>
          )}

          {published && (
            <Link href={`/${pageKey}`} className="inline-flex min-h-11 items-center rounded-control border border-ink/40 bg-ivory px-5 font-semibold">
              {tf("viewPublic")}
            </Link>
          )}
        </div>

        {!published && confirm === "publish" && (
          <ConfirmPanel
            label={t("publish")}
            message={t("publishConfirm")}
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
        {published && confirm === "unpublish" && (
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
      </div>
    </form>
  );
}
