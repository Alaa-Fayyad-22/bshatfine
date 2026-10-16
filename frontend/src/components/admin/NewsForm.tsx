"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import {
  AdminApiError,
  archiveNews,
  BODY_MAX,
  COVER_MAX_BYTES,
  COVER_TYPES,
  createNews,
  getAdminNews,
  publishNews,
  removeNewsCover,
  republishNews,
  updateNews,
  uploadNewsCover,
  type AdminNewsDto,
  type TranslationDto,
} from "@/lib/admin-api";
import { NewsCover } from "@/components/NewsCover";
import { rateProblem, type Problem } from "@/lib/problem";
import { DELETED_FLASH_KEY, DeleteNewsDialog } from "./DeleteNewsDialog";
import { isRateLimited, ProblemNotice } from "./ProblemNotice";
import { StatusText } from "./StatusText";

const MAX_TITLE = 200;
// From here on the body counter warns that the limit is close.
const BODY_WARN = Math.floor(BODY_MAX * 0.9);
const FLASH_KEY = "admin-news-flash";
const langs = ["ar", "en"] as const;
type Lang = (typeof langs)[number];
type Values = Record<Lang, { title: string; body: string }>;
type Busy = "save" | "publish" | "archive" | "republish" | "upload" | "removeCover" | null;
type Flash = "createdOk" | "publishedOk";

// Ref callback for an inline confirmation panel: focus it as soon as it appears.
// Defined outside the component so React calls it only on mount.
const focusOnMount = (el: HTMLElement | null) => el?.focus();

// Escape closes an inline confirmation (unless a request is running).
// True (after swallowing the key) when Escape was pressed and cancelling is allowed.
function escapePressed(e: KeyboardEvent<HTMLElement>, enabled: boolean): boolean {
  if (e.key !== "Escape" || !enabled) return false;
  e.preventDefault();
  e.stopPropagation();
  return true;
}

const empty: Values = { ar: { title: "", body: "" }, en: { title: "", body: "" } };

function toValues(article: AdminNewsDto): Values {
  const v: Values = { ar: { ...empty.ar }, en: { ...empty.en } };
  for (const tr of article.translations) v[tr.language] = { title: tr.title, body: tr.body };
  return v;
}

// Only translations with both a title and a body are sent.
function toTranslations(values: Values): TranslationDto[] {
  return langs
    .filter((l) => values[l].title.trim() && values[l].body.trim())
    .map((l) => ({ language: l, title: values[l].title.trim(), body: values[l].body.trim() }));
}

export function NewsForm({ id }: { id?: string }) {
  const t = useTranslations("Admin.form");
  const tl = useTranslations("Admin.languages");
  const format = useFormatter();
  const router = useRouter();
  const locale = useLocale();
  const uid = useId();

  const [load, setLoad] = useState<"loading" | "ready" | "notfound" | "error">(
    id ? "loading" : "ready",
  );
  const [article, setArticle] = useState<AdminNewsDto | null>(null);
  const [values, setValues] = useState<Values>(empty);
  const [baseline, setBaseline] = useState(JSON.stringify(empty));
  const [tab, setTab] = useState<Lang>("ar");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Too many requests: counts down, and the buttons stay disabled meanwhile.
  const [rate, setRate] = useState<Problem | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmRepublish, setConfirmRepublish] = useState(false);
  const [confirmRemoveCover, setConfirmRemoveCover] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Someone else saved this article after it was loaded (the API answered 409).
  // What the person typed stays in the form until they choose to reload.
  const [conflict, setConflict] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  const [reloading, setReloading] = useState(false);
  const conflictRef = useRef<HTMLDivElement | null>(null);
  const reloadBtnRef = useRef<HTMLButtonElement | null>(null);
  const [conflictFocus, setConflictFocus] = useState(0);
  const fileRef = useRef<HTMLInputElement | null>(null);
  // Keyboard focus: the button that opens an inline confirmation disappears, so
  // focus moves into the panel, back to the opener on Cancel, and to the status
  // message once the action has happened.
  const archiveBtnRef = useRef<HTMLButtonElement | null>(null);
  const republishBtnRef = useRef<HTMLButtonElement | null>(null);
  const removeCoverBtnRef = useRef<HTMLButtonElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const focusLater = (ref: { current: HTMLElement | null }) =>
    setTimeout(() => ref.current?.focus(), 0);
  // The status message only becomes visible (and focusable) after the render
  // that shows it, so its focus is applied in an effect, not a timer.
  const [statusFocus, setStatusFocus] = useState(0);
  const focusStatus = () => setStatusFocus((n) => n + 1);
  useEffect(() => {
    if (statusFocus > 0) statusRef.current?.focus();
  }, [statusFocus]);
  // The conflict message appears at the bottom of a long form: bring keyboard
  // and screen reader users to it.
  useEffect(() => {
    if (conflictFocus > 0) conflictRef.current?.focus();
  }, [conflictFocus]);
  const tabRefs = useRef<Record<Lang, HTMLButtonElement | null>>({ ar: null, en: null });

  const dirty = JSON.stringify(values) !== baseline;
  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const archived = article?.status === "Archived";
  const waiting = isRateLimited(rate);
  const readOnly = archived || busy !== null;

  // Adopt an article the API returned: its fields AND its new version number,
  // so the next save is checked against the latest state, not the one loaded.
  function apply(dto: AdminNewsDto) {
    const v = toValues(dto);
    setConflict(false);
    setConfirmReload(false);
    setArticle(dto);
    setValues(v);
    setBaseline(JSON.stringify(v));
  }

  // Load the article when editing.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getAdminNews(id).then(
      (dto) => {
        if (cancelled) return;
        if (!dto) return setLoad("notfound");
        apply(dto);
        setLoad("ready");
        try {
          const flash = sessionStorage.getItem(FLASH_KEY) as Flash | null;
          sessionStorage.removeItem(FLASH_KEY);
          if (flash === "createdOk" || flash === "publishedOk") setSuccess(t(flash));
        } catch {
          // sessionStorage unavailable: no confirmation message.
        }
      },
      () => !cancelled && setLoad("error"),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
      if (!window.confirm(t("leaveConfirm"))) {
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
  }, [t]);

  function describe(e: unknown): string {
    if (e instanceof AdminApiError) return e.detail ?? t("apiError", { status: e.status });
    return t("networkError");
  }

  // After creating, go to the edit page of the new article.
  function goToEdit(newId: string, flash: Flash) {
    try {
      sessionStorage.setItem(FLASH_KEY, flash);
    } catch {
      // Ignore: the confirmation message is optional.
    }
    dirtyRef.current = false; // do not warn about the navigation we trigger
    router.replace(`/admin/news/${newId}`);
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
        setConflictFocus((n) => n + 1);
      } else setError(describe(e));
    } finally {
      setBusy(null);
    }
  }

  // A body over the limit blocks saving (the API would answer 400 anyway). Says
  // which language and jumps to its tab; returns true when saving must stop.
  function bodyTooLong(): boolean {
    const over = langs.find((l) => values[l].body.length > BODY_MAX);
    if (!over) return false;
    setSuccess(null);
    setError(t("bodyTooLong", { language: tl(over), max: BODY_MAX }));
    setTab(over);
    return true;
  }

  // The latest saved version replaces the form (the person chose this, after the
  // warning), and its new version number is what later saves are checked against.
  async function loadLatest() {
    if (!article) return;
    setReloading(true);
    try {
      const latest = await getAdminNews(article.id);
      if (!latest) return setLoad("notfound");
      apply(latest);
      setConflict(false);
      setConfirmReload(false);
      setError(null);
      setSuccess(t("latestLoadedOk"));
      focusStatus();
    } catch (e) {
      setConfirmReload(false);
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
      if (article) {
        apply(await updateNews(article.id, translations, article.version));
        setSuccess(t(article.status === "Published" ? "changesSavedOk" : "savedOk"));
      } else {
        const created = await createNews(translations);
        goToEdit(created.id, "createdOk");
      }
    });
  }

  function publish() {
    const translations = toTranslations(values);
    if (translations.length === 0) return setError(t("needContent"));
    if (bodyTooLong()) return;
    return run("publish", async () => {
      // Save first (create, or update if edited), then publish.
      let target = article;
      const isNew = !target;
      if (!target) target = await createNews(translations);
      else if (dirty) target = await updateNews(target.id, translations, target.version);
      try {
        const published = await publishNews(target.id);
        if (isNew) return goToEdit(published.id, "publishedOk");
        apply(published);
        setSuccess(t("publishedOk"));
      } catch (e) {
        // The save went through even though publishing was refused. Stay on
        // the page (so the reason stays visible), adopt the saved draft and
        // point the address bar at its edit URL without remounting.
        apply(target);
        if (isNew) {
          window.history.replaceState(null, "", `/${locale}/admin/news/${target.id}`);
        }
        throw e;
      }
    });
  }

  function archive() {
    if (!article) return;
    return run("archive", async () => {
      apply(await archiveNews(article.id));
      setConfirmArchive(false);
      setSuccess(t("archivedOk"));
      focusStatus();
    });
  }

  function republish() {
    if (!article) return;
    return run("republish", async () => {
      // Back to Published: the API keeps the original publication date and slug.
      apply(await republishNews(article.id));
      setConfirmRepublish(false);
      setSuccess(t("republishedOk"));
      focusStatus();
    });
  }

  // The file was chosen in the hidden input. Check it here first, so an
  // obviously wrong file never costs an upload; the API still has the last word
  // and its message is shown as is.
  function onCoverPicked(file: File | undefined) {
    if (fileRef.current) fileRef.current.value = ""; // allow picking the same file again
    if (!file) return;
    if (!(COVER_TYPES as readonly string[]).includes(file.type)) {
      setSuccess(null);
      return setError(t("coverTypeError"));
    }
    if (file.size > COVER_MAX_BYTES) {
      setSuccess(null);
      return setError(t("coverSizeError", { max: COVER_MAX_BYTES / (1024 * 1024) }));
    }

    if (article) {
      return run("upload", async () => {
        // Only the cover changes: keep whatever is typed in the form.
        setArticle(await uploadNewsCover(article.id, file));
        setSuccess(t("coverUploadedOk"));
      });
    }

    // New article: a cover needs a saved draft, so save it first.
    const translations = toTranslations(values);
    if (translations.length === 0) {
      setSuccess(null);
      return setError(t("coverNeedContent"));
    }
    if (bodyTooLong()) return;
    return run("upload", async () => {
      const created = await createNews(translations);
      try {
        await uploadNewsCover(created.id, file);
      } catch (e) {
        // The draft exists now. Stay here so the reason stays visible, adopt it
        // and point the address bar at its edit URL without remounting.
        apply(created);
        window.history.replaceState(null, "", `/${locale}/admin/news/${created.id}`);
        throw e;
      }
      goToEdit(created.id, "createdOk");
    });
  }

  function removeCover() {
    if (!article) return;
    return run("removeCover", async () => {
      setArticle(await removeNewsCover(article.id));
      setConfirmRemoveCover(false);
      setSuccess(t("coverRemovedOk"));
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
      href="/admin/news"
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
  if (load === "notfound" || load === "error") {
    return (
      <div role="alert" className="max-w-prose">
        <p>{load === "notfound" ? t("notFound") : t("loadError")}</p>
        <div className="mt-3">{backLink}</div>
      </div>
    );
  }

  // The delete confirmation names the saved title (Arabic first, like the list).
  const savedTitle = (language: Lang) =>
    article?.translations.find((x) => x.language === language && x.title)?.title;
  const deleteTitle = savedTitle("ar")
    ? { text: savedTitle("ar")!, lang: "ar" }
    : savedTitle("en")
      ? { text: savedTitle("en")!, lang: "en" }
      : null;

  const dateRow = (label: string, iso: string | null | undefined) =>
    iso ? (
      <div>
        <dt className="text-ink/70">{label}</dt>
        <dd>
          <time dateTime={iso}>{format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" })}</time>
        </dd>
      </div>
    ) : null;

  const button =
    "inline-flex min-h-11 items-center justify-center rounded-control border px-5 font-semibold disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!readOnly && !waiting) save();
      }}
      noValidate
      className="max-w-3xl"
    >
      <div className="mb-2">{backLink}</div>
      <h1 className="text-2xl font-bold md:text-3xl">{article ? t("editTitle") : t("newTitle")}</h1>

      {article && (
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <dt className="text-ink/70">{t("status")}</dt>
            <dd className="font-medium">
              <StatusText status={article.status} />
            </dd>
          </div>
          <div>
            <dt className="text-ink/70">{t("slug")}</dt>
            <dd>
              <code dir="ltr" className="font-mono">
                {article.slug}
              </code>
            </dd>
          </div>
          {dateRow(t("created"), article.createdAt)}
          {dateRow(t("updated"), article.updatedAt)}
          {dateRow(t("published"), article.publishedAt)}
        </dl>
      )}

      {archived && (
        <p role="note" className="mt-6 border-s-4 border-alert-warn bg-sand px-4 py-3">
          {t("archivedNote")}
        </p>
      )}

      <section aria-labelledby={`${uid}-cover-title`} className="mt-8 border-t border-hairline pt-6">
        <h2 id={`${uid}-cover-title`} className="font-medium">
          {t("coverTitle")}
        </h2>
        <div className="mt-3 grid max-w-xl gap-4">
          <div className="relative aspect-[3/2] overflow-hidden rounded-card bg-sand">
            {article?.coverImageUrl ? (
              <NewsCover
                coverImageUrl={article.coverImageUrl}
                title={t("coverPreviewAlt")}
                sizes="(min-width: 768px) 36rem, 100vw"
              />
            ) : (
              <p className="absolute inset-0 grid place-items-center px-4 text-center text-sm text-ink/70">
                {t("coverNone")}
              </p>
            )}
            {(busy === "upload" || busy === "removeCover") && (
              <p
                role="status"
                className="absolute inset-0 grid place-items-center bg-ivory/80 font-medium"
              >
                {busy === "upload" ? t("coverUploading") : t("coverRemoving")}
              </p>
            )}
          </div>
          {!archived && (
            <>
              <p id={`${uid}-cover-hint`} className="text-sm text-ink/70">
                {article ? t("coverHint") : t("coverHintNew")}
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
                  className={`${button} border-cedar bg-ivory text-cedar`}
                >
                  {article?.coverImageUrl ? t("coverReplace") : t("coverChoose")}
                </button>
                {article?.coverImageUrl && !confirmRemoveCover && (
                  <button
                    ref={removeCoverBtnRef}
                    type="button"
                    disabled={busy !== null || waiting}
                    onClick={() => setConfirmRemoveCover(true)}
                    className={`${button} border-alert-danger bg-ivory text-alert-danger`}
                  >
                    {t("coverRemove")}
                  </button>
                )}
              </div>
              {article?.coverImageUrl && confirmRemoveCover && (
                <div
                  ref={focusOnMount}
                  tabIndex={-1}
                  role="alertdialog"
                  aria-label={t("coverRemove")}
                  onKeyDown={(e) => {
                    if (!escapePressed(e, busy === null)) return;
                    setConfirmRemoveCover(false);
                    focusLater(removeCoverBtnRef);
                  }}
                  className="max-w-prose border border-alert-danger p-4 outline-none"
                >
                  <p>{t("coverRemoveConfirm")}</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={removeCover}
                      disabled={busy !== null || waiting}
                      className={`${button} border-alert-danger bg-alert-danger text-ivory`}
                    >
                      {busy === "removeCover" ? t("coverRemoving") : t("coverRemoveYes")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmRemoveCover(false);
                        focusLater(removeCoverBtnRef);
                      }}
                      disabled={busy !== null || waiting}
                      className={`${button} border-ink/40 bg-ivory`}
                    >
                      {t("cancel")}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <div
        role="tablist"
        aria-label={t("languagesLabel")}
        className="mt-8 flex gap-1 border-b border-hairline"
      >
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
              {filled ? <span className="sr-only"> ({t("tabHint")})</span> : null}
              {filled ? <span aria-hidden className="ms-2 inline-block size-1.5 rounded-full bg-gold" /> : null}
            </button>
          );
        })}
      </div>

      {langs.map((l) => (
        <div
          key={l}
          role="tabpanel"
          id={`${uid}-panel-${l}`}
          aria-labelledby={`${uid}-tab-${l}`}
          hidden={tab !== l}
          className="mt-6 space-y-6"
        >
          <div>
            <label htmlFor={`${uid}-title-${l}`} className="block font-medium">
              {t("fieldTitle")}
            </label>
            <input
              id={`${uid}-title-${l}`}
              type="text"
              lang={l}
              dir={l === "ar" ? "rtl" : "ltr"}
              maxLength={MAX_TITLE}
              readOnly={readOnly}
              value={values[l].title}
              aria-describedby={`${uid}-count-${l}`}
              onChange={(e) => setValues((v) => ({ ...v, [l]: { ...v[l], title: e.target.value } }))}
              className="mt-1 block min-h-11 w-full rounded-control border border-ink/40 bg-ivory px-3 py-2 read-only:bg-sand"
            />
            <p id={`${uid}-count-${l}`} className="mt-1 text-sm text-ink/70">
              {t("chars", { count: values[l].title.length, max: MAX_TITLE })}
            </p>
          </div>
          <div>
            <label htmlFor={`${uid}-body-${l}`} className="block font-medium">
              {t("fieldBody")}
            </label>
            <textarea
              id={`${uid}-body-${l}`}
              lang={l}
              dir={l === "ar" ? "rtl" : "ltr"}
              rows={14}
              readOnly={readOnly}
              value={values[l].body}
              aria-describedby={`${uid}-bodycount-${l}`}
              aria-invalid={values[l].body.length > BODY_MAX || undefined}
              onChange={(e) => setValues((v) => ({ ...v, [l]: { ...v[l], body: e.target.value } }))}
              className="mt-1 block w-full rounded-control border border-ink/40 bg-ivory px-3 py-2 leading-relaxed read-only:bg-sand aria-[invalid=true]:border-alert-danger"
            />
            {/* The counter is not a live region (it would chatter on every key);
                the warning below it is, and its text changes only at the limits. */}
            <p
              id={`${uid}-bodycount-${l}`}
              className={`mt-1 text-sm ${
                values[l].body.length > BODY_MAX
                  ? "font-medium text-alert-danger"
                  : values[l].body.length >= BODY_WARN
                    ? "font-semibold text-ink"
                    : "text-ink/70"
              }`}
            >
              {t("chars", { count: values[l].body.length, max: BODY_MAX })}
            </p>
            <div aria-live="polite" className="empty:hidden">
              {values[l].body.length > BODY_MAX ? (
                <p className="mt-1 text-sm font-medium text-alert-danger">{t("bodyOver")}</p>
              ) : values[l].body.length >= BODY_WARN ? (
                <p className="mt-1 text-sm text-ink/80">{t("bodyNear")}</p>
              ) : null}
            </div>
          </div>
        </div>
      ))}

      <div className="mt-8 border-t border-hairline pt-6">
        {/* Announced to screen readers when a message appears */}
        <div ref={statusRef} tabIndex={-1} aria-live="polite" role="status" className="outline-none empty:hidden">
          {success && <p className="mb-4 font-medium text-cedar">{success}</p>}
          {dirty && !archived && !success && !error && (
            <p className="mb-4 text-sm text-ink/70">{t("unsaved")}</p>
          )}
        </div>
        {error && (
          <p
            role="alert"
            className="mb-4 border-s-4 border-alert-danger bg-sand px-4 py-3 text-alert-danger"
          >
            <span className="sr-only">{t("errorTitle")}: </span>
            {error}
          </p>
        )}
        {rate && (
          <div className="mb-4">
            <ProblemNotice problem={rate} onRateDone={() => setRate(null)} />
          </div>
        )}

        {/* Someone else saved this article first. Announced when it appears;
            the typed text above stays untouched until the person chooses. */}
        <div aria-live="assertive" role="alert" className="empty:hidden">
          {conflict && (
            <div
              ref={conflictRef}
              tabIndex={-1}
              className="mb-4 border-s-4 border-alert-danger bg-sand px-4 py-3 outline-none"
            >
              <p className="font-medium text-alert-danger">{t("conflictTitle")}</p>
              <p className="mt-1">{t("conflictText")}</p>
              {!confirmReload && (
                <button
                  ref={reloadBtnRef}
                  type="button"
                  onClick={() => setConfirmReload(true)}
                  disabled={reloading}
                  className={`${button} mt-3 border-cedar bg-ivory text-cedar`}
                >
                  {t("loadLatest")}
                </button>
              )}
            </div>
          )}
        </div>
        {conflict && confirmReload && (
          <div
            ref={focusOnMount}
            tabIndex={-1}
            role="alertdialog"
            aria-label={t("loadLatest")}
            onKeyDown={(e) => {
              if (!escapePressed(e, !reloading)) return;
              setConfirmReload(false);
              focusLater(reloadBtnRef);
            }}
            className="mb-4 max-w-prose border border-alert-danger p-4 outline-none"
          >
            <p>{t("loadLatestConfirm")}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={loadLatest}
                disabled={reloading}
                className={`${button} border-alert-danger bg-alert-danger text-ivory`}
              >
                {reloading ? t("loadingLatest") : t("loadLatestYes")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmReload(false);
                  focusLater(reloadBtnRef);
                }}
                disabled={reloading}
                className={`${button} border-ink/40 bg-ivory`}
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        )}

        {archived && (
          <div className="flex flex-wrap items-center gap-3">
            {!confirmRepublish && (
              <button
                ref={republishBtnRef}
                type="button"
                onClick={() => setConfirmRepublish(true)}
                disabled={busy !== null || waiting}
                className={`${button} border-cedar bg-cedar text-ivory`}
              >
                {t("republish")}
              </button>
            )}
          </div>
        )}

        {archived && confirmRepublish && (
          <div
            ref={focusOnMount}
            tabIndex={-1}
            role="alertdialog"
            aria-label={t("republish")}
            onKeyDown={(e) => {
              if (!escapePressed(e, busy === null)) return;
              setConfirmRepublish(false);
              focusLater(republishBtnRef);
            }}
            className="mt-4 max-w-prose border border-cedar p-4 outline-none"
          >
            <p>{t("republishConfirm")}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={republish}
                disabled={busy !== null || waiting}
                className={`${button} border-cedar bg-cedar text-ivory`}
              >
                {busy === "republish" ? t("republishing") : t("republishYes")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmRepublish(false);
                  focusLater(republishBtnRef);
                }}
                disabled={busy !== null}
                className={`${button} border-ink/40 bg-ivory`}
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        )}

        {!archived && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy !== null || waiting || conflict}
              className={`${button} border-cedar bg-cedar text-ivory`}
            >
              {busy === "save"
                ? t("saving")
                : article?.status === "Published"
                  ? t("saveChanges")
                  : t("saveDraft")}
            </button>

            {(!article || article.status === "Draft") && (
              <button
                type="button"
                onClick={publish}
                disabled={busy !== null || waiting || conflict}
                className={`${button} border-cedar bg-ivory text-cedar`}
              >
                {busy === "publish" ? t("publishing") : t("publish")}
              </button>
            )}

            {/* Only drafts can be deleted; published news can only be archived. */}
            {article?.status === "Draft" && (
              <button
                type="button"
                onClick={() => setDeleting(true)}
                disabled={busy !== null || waiting}
                className={`${button} border-alert-danger bg-ivory text-alert-danger`}
              >
                {t("delete")}
              </button>
            )}

            {article?.status === "Published" && (
              <Link
                href={`/news/${article.slug}`}
                className={`${button} border-ink/40 bg-ivory`}
              >
                {t("viewPublic")}
              </Link>
            )}

            {article?.status === "Published" && !confirmArchive && (
              <button
                ref={archiveBtnRef}
                type="button"
                onClick={() => setConfirmArchive(true)}
                disabled={busy !== null || waiting}
                className={`${button} border-alert-danger bg-ivory text-alert-danger`}
              >
                {t("archive")}
              </button>
            )}
          </div>
        )}

        {article?.status === "Published" && confirmArchive && (
          <div
            ref={focusOnMount}
            tabIndex={-1}
            role="alertdialog"
            aria-label={t("archive")}
            onKeyDown={(e) => {
              if (!escapePressed(e, busy === null)) return;
              setConfirmArchive(false);
              focusLater(archiveBtnRef);
            }}
            className="mt-4 max-w-prose border border-alert-danger p-4 outline-none"
          >
            <p>{t("archiveConfirm")}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={archive}
                disabled={busy !== null || waiting}
                className={`${button} border-alert-danger bg-alert-danger text-ivory`}
              >
                {busy === "archive" ? t("archiving") : t("archiveYes")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmArchive(false);
                  focusLater(archiveBtnRef);
                }}
                disabled={busy !== null || waiting}
                className={`${button} border-ink/40 bg-ivory`}
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        )}
      </div>

      {article && deleting && (
        <DeleteNewsDialog
          id={article.id}
          title={deleteTitle?.text ?? t("untitled")}
          lang={deleteTitle?.lang}
          onClose={() => setDeleting(false)}
          onDeleted={() => {
            try {
              sessionStorage.setItem(DELETED_FLASH_KEY, deleteTitle?.text ?? "");
            } catch {
              // Ignore: the confirmation message is optional.
            }
            dirtyRef.current = false; // do not warn about the navigation we trigger
            router.replace("/admin/news");
          }}
        />
      )}
    </form>
  );
}
