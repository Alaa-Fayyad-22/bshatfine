"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Markdown } from "@/components/Markdown";
import { NewsCover } from "@/components/NewsCover";
import {
  EVENT_BODY_MAX,
  EVENT_CATEGORIES,
  EVENT_LANGUAGES,
  EVENT_LOCATION_MAX,
  EVENT_MAP_URL_MAX,
  EVENT_ORGANIZER_MAX,
  EVENT_SUMMARY_MAX,
  EVENT_TITLE_MAX,
  EVENT_YEAR_MAX,
  EVENT_YEAR_MIN,
  isEventCategory,
  isSafeMapUrl,
  type EventLanguage,
} from "@/config/events";
import { Link, useRouter } from "@/i18n/navigation";
import {
  AdminApiError,
  createEvent,
  deleteEvent,
  getAdminEvent,
  isPayloadTooLarge,
  publishEvent,
  removeEventCover,
  unpublishEvent,
  updateEvent,
  uploadEventCover,
  type AdminEventDto,
  type EventInput,
  type EventTranslationDto,
} from "@/lib/admin-api";
import {
  beirutParts,
  beirutToIso,
  formatEventWhen,
  formatStamp,
  isValidDate,
  isValidTime,
} from "@/lib/event-time";
import { formatNumber, formatYear } from "@/lib/numbers";
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
import { EVENT_DELETED_FLASH_KEY, eventTitle } from "./EventsTable";
import { isRateLimited, ProblemNotice } from "./ProblemNotice";

const BODY_WARN = Math.floor(EVENT_BODY_MAX * 0.9);
const langs = EVENT_LANGUAGES;
type Lang = EventLanguage;
type Text = { title: string; summary: string; body: string; location: string; organizer: string };
type Values = Record<Lang, Text>;
// The schedule and details as typed in the form ("" = empty). Dates and times
// are Beirut wall-clock values ("2026-12-20", "18:00").
type Fields = {
  category: string;
  isAllDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  mapUrl: string;
};
type Busy = "save" | "publish" | "unpublish" | "prepare" | "upload" | "removeCover" | "delete" | null;
type Confirm = "publish" | "unpublish" | "removeCover" | "delete" | null;

const emptyText: Text = { title: "", summary: "", body: "", location: "", organizer: "" };
const emptyValues = (): Values => ({ ar: { ...emptyText }, en: { ...emptyText } });
const emptyFields: Fields = {
  category: "",
  isAllDay: false,
  startDate: "",
  startTime: "",
  endDate: "",
  endTime: "",
  mapUrl: "",
};

const filled = (x: Text) => Object.values(x).some((v) => v.trim() !== "");
const snapshot = (values: Values, fields: Fields) => JSON.stringify({ values, fields });

function toValues(ev: AdminEventDto): Values {
  const v = emptyValues();
  for (const tr of ev.translations) {
    if (tr.language in v) {
      v[tr.language] = {
        title: tr.title,
        summary: tr.summary,
        body: tr.body ?? "",
        location: tr.location ?? "",
        organizer: tr.organizer ?? "",
      };
    }
  }
  return v;
}

function toFields(ev: AdminEventDto): Fields {
  const start = beirutParts(ev.startsAt);
  const end = ev.endsAt ? beirutParts(ev.endsAt) : null;
  return {
    category: ev.category ?? "",
    isAllDay: ev.isAllDay,
    startDate: start.date,
    startTime: ev.isAllDay ? "" : start.time,
    endDate: end?.date ?? "",
    endTime: end && !ev.isAllDay ? end.time : "",
    mapUrl: ev.mapUrl ?? "",
  };
}

type Schedule = Pick<EventInput, "startsAt" | "endsAt" | "isAllDay">;
type ScheduleError =
  | "startDateRequired"
  | "yearRange"
  | "startTimeRequired"
  | "endDateInvalid"
  | "endTimeRequired"
  | "endBeforeStart";

// The schedule as the API wants it (ISO with Beirut's offset), or the key of
// the message saying what to fix.
function toSchedule(
  f: Fields,
): { ok: true; value: Schedule & { startsAt: string } } | { ok: false; error: ScheduleError } {
  if (!isValidDate(f.startDate)) return { ok: false, error: "startDateRequired" };
  const year = Number(f.startDate.slice(0, 4));
  if (year < EVENT_YEAR_MIN || year > EVENT_YEAR_MAX) return { ok: false, error: "yearRange" };

  if (f.isAllDay) {
    const startsAt = beirutToIso(f.startDate)!;
    if (f.endDate === "") return { ok: true, value: { startsAt, endsAt: null, isAllDay: true } };
    if (!isValidDate(f.endDate)) return { ok: false, error: "endDateInvalid" };
    if (f.endDate < f.startDate) return { ok: false, error: "endBeforeStart" };
    return { ok: true, value: { startsAt, endsAt: beirutToIso(f.endDate)!, isAllDay: true } };
  }

  if (!isValidTime(f.startTime)) return { ok: false, error: "startTimeRequired" };
  const startsAt = beirutToIso(f.startDate, f.startTime)!;
  if (f.endDate === "" && f.endTime === "") return { ok: true, value: { startsAt, endsAt: null, isAllDay: false } };
  // An end time alone means the same day.
  const endDate = f.endDate || f.startDate;
  if (!isValidDate(endDate)) return { ok: false, error: "endDateInvalid" };
  if (!isValidTime(f.endTime)) return { ok: false, error: "endTimeRequired" };
  const endsAt = beirutToIso(endDate, f.endTime)!;
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) return { ok: false, error: "endBeforeStart" };
  return { ok: true, value: { startsAt, endsAt, isAllDay: false } };
}

// The editor of one event. `id` edits an existing event; without it, the first
// save creates it (and the address becomes the event's own).
export function EventForm({ id }: { id?: string }) {
  const t = useTranslations("Admin.eventForm");
  const tf = useTranslations("Admin.form");
  const te = useTranslations("Admin.events");
  const tl = useTranslations("Admin.languages");
  const tc = useTranslations("Events.categories");
  const locale = useLocale();
  const num = (value: number) => formatNumber(value, locale);
  const router = useRouter();
  const uid = useId();

  const [load, setLoad] = useState<"loading" | "ready" | "error" | "notfound">(id ? "loading" : "ready");
  // null until the event exists (the first save creates it).
  const [event, setEvent] = useState<AdminEventDto | null>(null);
  const [past, setPast] = useState(false);
  const [values, setValues] = useState<Values>(emptyValues);
  const [fields, setFields] = useState<Fields>(emptyFields);
  const [baseline, setBaseline] = useState(() => snapshot(emptyValues(), emptyFields));
  const [tab, setTab] = useState<Lang>("ar");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rate, setRate] = useState<Problem | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  // Someone else saved this event after it was loaded (the API answered 409).
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
  const published = event?.isPublished ?? false;

  // Adopt an event the API returned: its fields AND its new version number.
  function apply(dto: AdminEventDto) {
    const v = toValues(dto);
    const f = toFields(dto);
    setConflict(false);
    adoptState(dto);
    setValues(v);
    setFields(f);
    setBaseline(snapshot(v, f));
  }

  // Adopt only the state and version (publish, cover...): what is typed and not
  // saved yet stays as it is.
  // "Upcoming" / "Past" is judged against the time the event was last received.
  function adoptState(dto: AdminEventDto) {
    setEvent(dto);
    setPast(new Date(dto.finishesAt).getTime() < Date.now());
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getAdminEvent(id).then(
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

  // Warn before leaving with unsaved changes (closing the tab, in-app links).
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
    focusStatus();
    return null;
  }

  const trimmedMap = fields.mapUrl.trim();
  const mapInvalid = trimmedMap !== "" && !isSafeMapUrl(trimmedMap);
  const schedule = toSchedule(fields);

  // Every language with anything typed is sent (the languages sent become the
  // event's languages). Returns null (with a message) when something must be
  // fixed first.
  function collect(): EventInput | null {
    const translations: EventTranslationDto[] = [];
    for (const l of langs) {
      const v = values[l];
      if (!filled(v)) continue;
      if (!v.title.trim() || !v.summary.trim()) return fail(t("incomplete", { language: tl(l) }), l);
      if (v.body.length > EVENT_BODY_MAX) return fail(t("bodyTooLong", { language: tl(l), max: num(EVENT_BODY_MAX) }), l);
      translations.push({
        language: l,
        title: v.title.trim(),
        summary: v.summary.trim(),
        body: v.body.trim(),
        location: v.location.trim(),
        organizer: v.organizer.trim(),
      });
    }
    if (translations.length === 0) return fail(t("needContent"));
    if (!isEventCategory(fields.category)) return fail(t("categoryRequired"));
    if (!schedule.ok) return fail(t(`schedule.${schedule.error}`, {
          min: formatYear(EVENT_YEAR_MIN, locale),
          max: formatYear(EVENT_YEAR_MAX, locale),
        }));
    if (mapInvalid) return fail(t("mapInvalid"));
    return { translations, category: fields.category, ...schedule.value, mapUrl: trimmedMap || null };
  }

  function save() {
    const data = collect();
    if (!data) return;
    return run("save", async () => {
      if (event) {
        apply(await updateEvent(event.id, data, event.version));
        setSuccess(t("savedOk"));
      } else {
        const created = await createEvent(data);
        apply(created);
        // The new event gets its own address without remounting the form.
        window.history.replaceState(null, "", `/${locale}/admin/events/${created.id}`);
        setSuccess(t("createdOk"));
      }
      focusStatus();
    });
  }

  function publish() {
    if (!event) return;
    const data = dirty ? collect() : null;
    if (dirty && !data) return;
    return run("publish", async () => {
      // Save first when edited, then publish.
      let current = event;
      if (data) {
        current = await updateEvent(current.id, data, current.version);
        apply(current);
      }
      adoptState(await publishEvent(current.id));
      setConfirm(null);
      setSuccess(t("publishedOk"));
      focusStatus();
    });
  }

  function unpublish() {
    if (!event) return;
    return run("unpublish", async () => {
      adoptState(await unpublishEvent(event.id));
      setConfirm(null);
      setSuccess(t("unpublishedOk"));
      focusStatus();
    });
  }

  function remove() {
    if (!event) return;
    const title = eventTitle(event)?.text ?? "";
    return run("delete", async () => {
      await deleteEvent(event.id);
      try {
        sessionStorage.setItem(EVENT_DELETED_FLASH_KEY, title);
      } catch {
        // The confirmation on the list is optional.
      }
      dirtyRef.current = false; // do not warn about the navigation we trigger
      router.replace("/admin/events");
    });
  }

  // Checked, scaled down and re-encoded in the browser first (see prepareImage).
  async function onCoverPicked(picked: File | undefined) {
    if (fileRef.current) fileRef.current.value = ""; // allow picking the same file again
    if (!picked || !event) return;
    setBusy("prepare");
    setError(null);
    setRate(null);
    setSuccess(null);
    const prepared = await prepareImage(picked);
    setBusy(null);
    if (!prepared.ok) return fail(tf(PHOTO_ERROR_KEYS[prepared.reason]));
    const file = prepared.file;
    return run("upload", async () => {
      adoptState(await uploadEventCover(event.id, file));
      setSuccess(tf("coverUploadedOk"));
      focusStatus();
    });
  }

  function removeCover() {
    if (!event) return;
    return run("removeCover", async () => {
      adoptState(await removeEventCover(event.id));
      setConfirm(null);
      setSuccess(tf("coverRemovedOk"));
      focusStatus();
    });
  }

  async function loadLatest() {
    if (!event) return;
    setReloading(true);
    try {
      const latest = await getAdminEvent(event.id);
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
  const setField = <K extends keyof Fields>(key: K, value: Fields[K]) => setFields((f) => ({ ...f, [key]: value }));

  const backLink = (
    <Link href="/admin/events" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
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

  const textField = (
    l: Lang,
    key: "title" | "location" | "organizer",
    label: string,
    max: number,
    hint?: string,
  ) => (
    <div>
      <label htmlFor={`${uid}-${key}-${l}`} className="block font-medium">
        {label}
      </label>
      {hint && (
        <p id={`${uid}-${key}hint-${l}`} className="mt-1 text-sm text-ink/70">
          {hint}
        </p>
      )}
      <input
        id={`${uid}-${key}-${l}`}
        type="text"
        lang={l}
        dir={l === "ar" ? "rtl" : "ltr"}
        maxLength={max}
        readOnly={readOnly}
        value={values[l][key]}
        aria-describedby={`${hint ? `${uid}-${key}hint-${l} ` : ""}${uid}-${key}count-${l}`}
        onChange={(e) => setText(l, key, e.target.value)}
        className={inputClass}
      />
      <p id={`${uid}-${key}count-${l}`} className="mt-1 text-sm text-ink/70">
        {t("chars", { count: num(values[l][key].length), max: num(max) })}
      </p>
    </div>
  );

  const dateInput = "mt-1 block min-h-11 w-full rounded-control border border-ink/40 bg-paper px-3 py-2 read-only:bg-stone";

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
      <h1 className="text-2xl font-bold md:text-3xl">{event ? t("editTitle") : t("createTitle")}</h1>

      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <dt className="text-ink/70">{t("status")}</dt>
          <dd className="inline-flex items-center gap-2 font-medium">
            <span
              aria-hidden
              className={`size-2 shrink-0 rounded-full ${!event ? "bg-ink/30" : published ? "bg-pine" : "bg-alert-warn"}`}
            />
            {!event ? t("notSaved") : published ? te("published") : te("unpublished")}
          </dd>
        </div>
        {event && (
          <div>
            <dt className="text-ink/70">{t("timing")}</dt>
            <dd className="font-medium">
              {past ? te("past") : te("upcoming")}
            </dd>
          </div>
        )}
        {stamp(t("created"), event?.createdAt)}
        {stamp(t("updated"), event?.updatedAt)}
        {stamp(t("published"), event?.publishedAt)}
      </dl>

      {/* ---------- Cover photo ---------- */}
      <section aria-labelledby={`${uid}-cover-title`} className="mt-8 border-t border-line pt-6">
        <h2 id={`${uid}-cover-title`} className="font-medium">
          {t("coverTitle")}
        </h2>
        <div className="mt-3 grid max-w-xl gap-4">
          <div className="relative aspect-[3/2] overflow-hidden rounded-card bg-stone">
            {event?.coverImageUrl ? (
              <NewsCover coverImageUrl={event.coverImageUrl} title={tf("coverPreviewAlt")} sizes="(min-width: 768px) 36rem, 100vw" />
            ) : (
              <p className="absolute inset-0 grid place-items-center px-4 text-center text-sm text-ink/70">{t("coverNone")}</p>
            )}
            {(busy === "prepare" || busy === "upload" || busy === "removeCover") && (
              <p role="status" className="absolute inset-0 grid place-items-center bg-paper/80 font-medium">
                {busy === "prepare" ? tf("photoPreparing") : busy === "upload" ? tf("coverUploading") : tf("coverRemoving")}
              </p>
            )}
          </div>
          <p id={`${uid}-cover-hint`} className={`text-sm ${event ? "text-ink/70" : "font-medium text-ink"}`}>
            {event ? tf("coverHint") : t("coverSaveFirst")}
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
              disabled={!event || busy !== null || waiting}
              aria-describedby={`${uid}-cover-hint`}
              onClick={() => fileRef.current?.click()}
              className={outlineButton}
            >
              {event?.coverImageUrl ? t("coverReplace") : t("coverChoose")}
            </button>
            {event?.coverImageUrl && confirm !== "removeCover" && (
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
          {event?.coverImageUrl && confirm === "removeCover" && (
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

      {/* ---------- When, category, map ---------- */}
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
              {EVENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {tc(c)}
                </option>
              ))}
              {fields.category && !isEventCategory(fields.category) && (
                <option value={fields.category}>{fields.category}</option>
              )}
            </select>
          </div>
          <div className="flex items-end">
            <label className="inline-flex min-h-11 items-center gap-3 font-medium">
              <input
                type="checkbox"
                checked={fields.isAllDay}
                disabled={readOnly}
                onChange={(e) => setField("isAllDay", e.target.checked)}
                className="size-5 accent-pine"
              />
              {t("allDay")}
            </label>
          </div>

          <div>
            <label htmlFor={`${uid}-start-date`} className="block font-medium">
              {fields.isAllDay ? t("firstDay") : t("startDate")}
            </label>
            <input
              id={`${uid}-start-date`}
              type="date"
              dir="ltr"
              min={`${EVENT_YEAR_MIN}-01-01`}
              max={`${EVENT_YEAR_MAX}-12-31`}
              readOnly={readOnly}
              value={fields.startDate}
              aria-describedby={`${uid}-tz`}
              onChange={(e) => setField("startDate", e.target.value)}
              className={dateInput}
            />
          </div>
          {!fields.isAllDay ? (
            <div>
              <label htmlFor={`${uid}-start-time`} className="block font-medium">
                {t("startTime")}
              </label>
              <input
                id={`${uid}-start-time`}
                type="time"
                dir="ltr"
                readOnly={readOnly}
                value={fields.startTime}
                aria-describedby={`${uid}-tz`}
                onChange={(e) => setField("startTime", e.target.value)}
                className={dateInput}
              />
            </div>
          ) : (
            <div aria-hidden className="hidden sm:block" />
          )}

          <div>
            <label htmlFor={`${uid}-end-date`} className="block font-medium">
              {fields.isAllDay ? t("lastDay") : t("endDate")}
            </label>
            <input
              id={`${uid}-end-date`}
              type="date"
              dir="ltr"
              min={fields.startDate || `${EVENT_YEAR_MIN}-01-01`}
              max={`${EVENT_YEAR_MAX}-12-31`}
              readOnly={readOnly}
              value={fields.endDate}
              aria-describedby={`${uid}-end-hint`}
              onChange={(e) => setField("endDate", e.target.value)}
              className={dateInput}
            />
          </div>
          {!fields.isAllDay && (
            <div>
              <label htmlFor={`${uid}-end-time`} className="block font-medium">
                {t("endTime")}
              </label>
              <input
                id={`${uid}-end-time`}
                type="time"
                dir="ltr"
                readOnly={readOnly}
                value={fields.endTime}
                aria-describedby={`${uid}-end-hint`}
                onChange={(e) => setField("endTime", e.target.value)}
                className={dateInput}
              />
            </div>
          )}
        </div>
        <p id={`${uid}-end-hint`} className="mt-2 max-w-prose text-sm text-ink/70">
          {fields.isAllDay ? t("endHintAllDay") : t("endHintTimed")}
        </p>
        <p className="mt-3 max-w-prose text-sm" aria-live="polite">
          {schedule.ok ? (
            <>
              <span className="text-ink/70">{t("shownAs")} </span>
              <span className="font-medium">
                {formatEventWhen(locale, schedule.value)}
              </span>
            </>
          ) : null}
        </p>

        <div className="mt-6 max-w-3xl">
          <label htmlFor={`${uid}-map`} className="block font-medium">
            {t("mapUrl")}
          </label>
          <p id={`${uid}-map-hint`} className="mt-1 text-sm text-ink/70">
            {t("mapHint")}
          </p>
          <input
            id={`${uid}-map`}
            type="url"
            inputMode="url"
            dir="ltr"
            maxLength={EVENT_MAP_URL_MAX}
            readOnly={readOnly}
            value={fields.mapUrl}
            aria-invalid={mapInvalid || undefined}
            aria-describedby={`${uid}-map-hint${mapInvalid ? ` ${uid}-map-error` : ""}`}
            onChange={(e) => setField("mapUrl", e.target.value)}
            className={inputClass}
          />
          {mapInvalid && (
            <p id={`${uid}-map-error`} className="mt-1 text-sm font-medium text-alert-danger">
              {t("mapInvalid")}
            </p>
          )}
        </div>
      </fieldset>

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
              {textField(l, "title", t("fieldTitle"), EVENT_TITLE_MAX)}
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
                  maxLength={EVENT_SUMMARY_MAX}
                  readOnly={readOnly}
                  value={v.summary}
                  aria-describedby={`${uid}-sumhint-${l} ${uid}-sumcount-${l}`}
                  onChange={(e) => setText(l, "summary", e.target.value)}
                  className="mt-2 block w-full rounded-control border border-ink/40 bg-paper px-3 py-2 leading-relaxed read-only:bg-stone"
                />
                <p id={`${uid}-sumcount-${l}`} className="mt-1 text-sm text-ink/70">
                  {t("chars", { count: num(v.summary.length), max: num(EVENT_SUMMARY_MAX) })}
                </p>
              </div>
              {textField(l, "location", t("fieldLocation"), EVENT_LOCATION_MAX, t("optional"))}
              {textField(l, "organizer", t("fieldOrganizer"), EVENT_ORGANIZER_MAX, t("optional"))}
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
                  rows={12}
                  readOnly={readOnly}
                  value={v.body}
                  aria-describedby={`${uid}-md-${l} ${uid}-bodycount-${l}`}
                  aria-invalid={bodyLen > EVENT_BODY_MAX || undefined}
                  onChange={(e) => setText(l, "body", e.target.value)}
                  className="mt-2 block w-full rounded-control border border-ink/40 bg-paper px-3 py-2 leading-relaxed read-only:bg-stone aria-[invalid=true]:border-alert-danger"
                />
                <p
                  id={`${uid}-bodycount-${l}`}
                  className={`mt-1 text-sm ${
                    bodyLen > EVENT_BODY_MAX
                      ? "font-medium text-alert-danger"
                      : bodyLen >= BODY_WARN
                        ? "font-semibold text-ink"
                        : "text-ink/70"
                  }`}
                >
                  {t("chars", { count: num(bodyLen), max: num(EVENT_BODY_MAX) })}
                </p>
                <div aria-live="polite" className="empty:hidden">
                  {bodyLen > EVENT_BODY_MAX ? (
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
                    {(v.location.trim() || v.organizer.trim()) && (
                      <p className="mt-3 text-sm break-words text-ink/80">
                        {[v.location.trim(), v.organizer.trim()].filter(Boolean).join(" · ")}
                      </p>
                    )}
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

          {event && !published && confirm !== "publish" && (
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

          {event && published && confirm !== "unpublish" && (
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

          {event && published && (
            <Link
              href={`/events/${event.id}`}
              className="inline-flex min-h-11 items-center rounded-control border border-ink/40 bg-paper px-5 font-semibold"
            >
              {tf("viewPublic")}
            </Link>
          )}

          {event && !published && confirm !== "delete" && (
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
        {event && published && <p className="mt-3 text-sm text-ink/70">{t("deletePublishedHint")}</p>}

        {event && !published && confirm === "publish" && (
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
        {event && published && confirm === "unpublish" && (
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
        {event && !published && confirm === "delete" && (
          <ConfirmPanel
            label={t("delete")}
            message={t("deleteConfirm", { title: eventTitle(event)?.text ?? te("untitled") })}
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
