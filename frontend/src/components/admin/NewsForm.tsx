"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import {
  AdminApiError,
  archiveNews,
  createNews,
  getAdminNews,
  publishNews,
  updateNews,
  type AdminNewsDto,
  type TranslationDto,
} from "@/lib/admin-api";
import { StatusText } from "./StatusText";

const MAX_TITLE = 200;
const FLASH_KEY = "admin-news-flash";
const langs = ["ar", "en"] as const;
type Lang = (typeof langs)[number];
type Values = Record<Lang, { title: string; body: string }>;
type Busy = "save" | "publish" | "archive" | null;
type Flash = "createdOk" | "publishedOk";

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
  const [confirmArchive, setConfirmArchive] = useState(false);
  const tabRefs = useRef<Record<Lang, HTMLButtonElement | null>>({ ar: null, en: null });

  const dirty = JSON.stringify(values) !== baseline;
  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const archived = article?.status === "Archived";
  const readOnly = archived || busy !== null;

  function apply(dto: AdminNewsDto) {
    const v = toValues(dto);
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
    setSuccess(null);
    try {
      await action();
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(null);
    }
  }

  function save() {
    const translations = toTranslations(values);
    if (translations.length === 0) return setError(t("needContent"));
    return run("save", async () => {
      if (article) {
        apply(await updateNews(article.id, translations));
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
    return run("publish", async () => {
      // Save first (create, or update if edited), then publish.
      let target = article;
      const isNew = !target;
      if (!target) target = await createNews(translations);
      else if (dirty) target = await updateNews(target.id, translations);
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
        if (!readOnly) save();
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
              onChange={(e) => setValues((v) => ({ ...v, [l]: { ...v[l], body: e.target.value } }))}
              className="mt-1 block w-full rounded-control border border-ink/40 bg-ivory px-3 py-2 leading-relaxed read-only:bg-sand"
            />
          </div>
        </div>
      ))}

      <div className="mt-8 border-t border-hairline pt-6">
        {/* Announced to screen readers when a message appears */}
        <div aria-live="polite" role="status" className="empty:hidden">
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

        {!archived && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy !== null}
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
                disabled={busy !== null}
                className={`${button} border-cedar bg-ivory text-cedar`}
              >
                {busy === "publish" ? t("publishing") : t("publish")}
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
                type="button"
                onClick={() => setConfirmArchive(true)}
                disabled={busy !== null}
                className={`${button} border-alert-danger bg-ivory text-alert-danger`}
              >
                {t("archive")}
              </button>
            )}
          </div>
        )}

        {article?.status === "Published" && confirmArchive && (
          <div role="alertdialog" aria-label={t("archive")} className="mt-4 max-w-prose border border-alert-danger p-4">
            <p>{t("archiveConfirm")}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={archive}
                disabled={busy !== null}
                className={`${button} border-alert-danger bg-alert-danger text-ivory`}
              >
                {busy === "archive" ? t("archiving") : t("archiveYes")}
              </button>
              <button
                type="button"
                onClick={() => setConfirmArchive(false)}
                disabled={busy !== null}
                className={`${button} border-ink/40 bg-ivory`}
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
