// The digits of the site, the same everywhere:
//   - Arabic pages: Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) in dates, times, years,
//     page numbers, counts...
//   - English pages: Western digits (0-9).
// Phone numbers, e-mail addresses and URLs are NOT formatted: they are shown
// exactly as entered, so they stay dialable and correct.
//
// Every number or date shown to visitors goes through the helpers below, never
// through a plain String(n), "{n}" in a message or Intl with the bare "ar" tag:
// recent ICU versions (Node 22, current browsers) write Western digits for "ar".
// The numbering system is therefore always named explicitly (-u-nu-arab/latn).

// The Intl locale of a page language: Levantine Arabic month names (كانون الأول)
// and British English ("20 December 2026"), each with its own digits.
export const INTL_LOCALE = { ar: "ar-LB-u-nu-arab", en: "en-GB-u-nu-latn" } as const;

export const intlLocale = (locale: string) => (locale === "ar" ? INTL_LOCALE.ar : INTL_LOCALE.en);

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

function cached<T>(map: Map<string, T>, key: string, make: () => T): T {
  let value = map.get(key);
  if (!value) {
    value = make();
    map.set(key, value);
  }
  return value;
}

// A number in the digits of the page: formatNumber(3, "ar") -> "٣",
// formatNumber(1234, "en") -> "1,234".
export function formatNumber(value: number, locale: string, options: Intl.NumberFormatOptions = {}): string {
  const tag = intlLocale(locale);
  return cached(numberFormats, `${tag}|${JSON.stringify(options)}`, () => new Intl.NumberFormat(tag, options)).format(
    value,
  );
}

// A year, without a thousands separator: "٢٠٢٦", "2026".
export const formatYear = (value: number, locale: string) => formatNumber(value, locale, { useGrouping: false });

// The Intl.DateTimeFormat of a page language (cached), for dates and times.
export function dateTimeFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const tag = intlLocale(locale);
  return cached(dateFormats, `${tag}|${JSON.stringify(options)}`, () => new Intl.DateTimeFormat(tag, options));
}

// A date (or date and time) in the language and digits of the page.
export const formatDate = (value: Date | string | number, locale: string, options: Intl.DateTimeFormatOptions) =>
  dateTimeFormat(locale, options).format(value instanceof Date ? value : new Date(value));
