// Event dates and times are ALWAYS Lebanon time (Asia/Beirut), whatever the
// time zone of the visitor's or editor's own device. Only the built-in Intl
// APIs are used, so summer time (+03:00) and winter time (+02:00) follow the
// time-zone database of the browser / Node.js, not a hand-written rule.
//
// - The API sends instants in UTC ("2026-12-20T16:00:00Z").
// - The admin form works with Beirut "wall clock" values ("2026-12-20", "18:00")
//   and sends them back with the right offset ("2026-12-20T18:00:00+02:00").
// - All-day events: the start is the first day at 00:00 Beirut, the end (if
//   any) the LAST day at 00:00 Beirut (the API counts that day inclusively).

export const EVENT_TIME_ZONE = "Asia/Beirut";

// The display locales: Levantine Arabic month names (كانون الأول...) and
// British English ("20 December 2026, 18:00").
export const DISPLAY_LOCALE = { ar: "ar-LB", en: "en-GB" } as const;
const displayLocale = (locale: string) => (locale === "ar" ? DISPLAY_LOCALE.ar : DISPLAY_LOCALE.en);

type Wall = { y: number; m: number; d: number; h: number; mi: number };

let partsFormat: Intl.DateTimeFormat | null = null;

// The Beirut wall-clock reading of an instant.
function wallOf(ms: number): Wall {
  partsFormat ??= new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p: Record<string, number> = {};
  for (const part of partsFormat.formatToParts(new Date(ms))) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  return { y: p.year, m: p.month, d: p.day, h: p.hour === 24 ? 0 : p.hour, mi: p.minute };
}

const wallUtc = (w: Wall) => Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi);

// Beirut's offset from UTC at an instant, in minutes (+120 or +180).
function offsetAt(ms: number): number {
  const whole = Math.floor(ms / 60_000) * 60_000;
  return Math.round((wallUtc(wallOf(whole)) - whole) / 60_000);
}

const pad = (n: number, size = 2) => String(Math.abs(n)).padStart(size, "0");

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  return `${sign}${pad(Math.floor(Math.abs(minutes) / 60))}:${pad(Math.abs(minutes) % 60)}`;
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^(\d{2}):(\d{2})$/;

// "2026-12-20" -> parts, or null when it is not a real calendar date.
function parseDate(value: string): { y: number; m: number; d: number } | null {
  const match = DATE.exec(value);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return { y, m, d };
}

function parseTime(value: string): { h: number; mi: number } | null {
  const match = TIME.exec(value);
  if (!match) return null;
  const [h, mi] = [Number(match[1]), Number(match[2])];
  return h < 24 && mi < 60 ? { h, mi } : null;
}

export const isValidDate = (value: string) => parseDate(value) !== null;
export const isValidTime = (value: string) => parseTime(value) !== null;

// A Beirut wall-clock date (and time, default midnight) as an ISO string with
// Beirut's offset ON THAT DAY: "2026-12-20T18:00:00+02:00",
// "2027-06-20T18:00:00+03:00". null for an invalid date or time.
//
// Around the clock changes: a time that occurs twice (autumn) takes its first
// occurrence; a time that does not exist (spring, e.g. midnight when the clocks
// jump to 01:00) keeps the winter offset, which is the moment the new day starts.
export function beirutToIso(date: string, time = "00:00"): string | null {
  const d = parseDate(date);
  const t = parseTime(time);
  if (!d || !t) return null;
  const target: Wall = { ...d, ...t };
  const asUtc = wallUtc(target);

  // The offsets in force half a day before and after: at most one change lies between.
  const before = offsetAt(asUtc - 12 * 3_600_000);
  const after = offsetAt(asUtc + 12 * 3_600_000);
  const candidates = [...new Set([before, after])]
    .map((offset) => ({ offset, ms: asUtc - offset * 60_000 }))
    .filter(({ ms }) => wallUtc(wallOf(ms)) === asUtc)
    .sort((a, b) => a.ms - b.ms);
  const offset = candidates[0]?.offset ?? before;

  return `${date}T${pad(t.h)}:${pad(t.mi)}:00${formatOffset(offset)}`;
}

// An instant from the API as Beirut wall-clock values for the form.
export function beirutParts(iso: string): { date: string; time: string } {
  const w = wallOf(new Date(iso).getTime());
  return { date: `${pad(w.y, 4)}-${pad(w.m)}-${pad(w.d)}`, time: `${pad(w.h)}:${pad(w.mi)}` };
}

// ---------- Display ----------

export type EventWhen = { startsAt: string; endsAt: string | null; isAllDay: boolean };

const formats = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = formats.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(displayLocale(locale), { timeZone: EVENT_TIME_ZONE, ...options });
    formats.set(key, f);
  }
  return f;
}

const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
const TIME_OF_DAY: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" };

const sameBeirutDay = (a: string, b: string) => beirutParts(a).date === beirutParts(b).date;

// The when of an event, in Beirut time:
//   "20 December 2026, 18:00"            timed, no end
//   "20 December 2026, 18:00–21:00"      timed, ends the same day
//   "20 December 2026, 18:00 – 22 December 2026, 21:00"
//   "20 December 2026"                   all-day, one day
//   "20–22 December 2026"                all-day, several days
export function formatEventWhen(locale: string, ev: EventWhen): string {
  const start = new Date(ev.startsAt);
  const end = ev.endsAt ? new Date(ev.endsAt) : null;
  if (ev.isAllDay) {
    const f = formatter(locale, DAY);
    return end && !sameBeirutDay(ev.startsAt, ev.endsAt!) ? f.formatRange(start, end) : f.format(start);
  }
  if (end && end.getTime() > start.getTime()) {
    return formatter(locale, { ...DAY, ...TIME_OF_DAY }).formatRange(start, end);
  }
  // Built from two parts: a single date-time would read "20 December 2026 at
  // 18:00" ("في" in Arabic), unlike the ranges above.
  const date = formatter(locale, DAY).format(start);
  const time = formatter(locale, TIME_OF_DAY).format(start);
  return `${date}${locale === "ar" ? "،" : ","} ${time}`;
}

// The pieces of the date box of the home page's event rows.
export function eventDateBox(locale: string, startsAt: string) {
  const start = new Date(startsAt);
  return {
    weekday: formatter(locale, { weekday: "long" }).format(start),
    day: formatter(locale, { day: "numeric" }).format(start),
    month: formatter(locale, { month: "long" }).format(start),
  };
}

// The start time alone ("18:00"), for timed events.
export const formatEventTime = (locale: string, iso: string) =>
  formatter(locale, TIME_OF_DAY).format(new Date(iso));

// Date and time of an admin timestamp (created, updated...), also in Beirut time.
export const formatStamp = (locale: string, iso: string) =>
  formatter(locale, { dateStyle: "medium", timeStyle: "short", hourCycle: "h23" }).format(new Date(iso));
