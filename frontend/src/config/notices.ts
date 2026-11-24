// The ONE place where the frontend knows the notice rules. It mirrors
// backend/Bshatfine.Domain/Notices/Notice.cs, NoticeTranslation.cs and
// Enums/NoticePriority.cs (categories, priorities, limits): change both
// together. The admin form, the admin list, the urgent banner and the public
// pages all read this file.
//
// Categories and priorities are CODES; their wording lives in messages/*.json
// under "Notices.categories.<code>" and "Notices.priorities.<code>"
// (shared by the public site and the admin).

export const NOTICE_CATEGORIES = [
  "water",
  "electricity",
  "roads",
  "waste",
  "fees",
  "council",
  "health",
  "general",
] as const;
export type NoticeCategory = (typeof NOTICE_CATEGORIES)[number];

// Most urgent first: the order the API sorts the active list in.
export const NOTICE_PRIORITIES = ["urgent", "important", "normal"] as const;
export type NoticePriority = (typeof NOTICE_PRIORITIES)[number];

export const NOTICE_LANGUAGES = ["ar", "en"] as const;
export type NoticeLanguage = (typeof NOTICE_LANGUAGES)[number];

export const isNoticeCategory = (value: unknown): value is NoticeCategory =>
  typeof value === "string" && (NOTICE_CATEGORIES as readonly string[]).includes(value);

export const isNoticePriority = (value: unknown): value is NoticePriority =>
  typeof value === "string" && (NOTICE_PRIORITIES as readonly string[]).includes(value);

// The badge of a priority (globals.css .nprio-*): urgent red, important amber,
// normal neutral. Colour is never the only signal: the badge always shows the
// priority word too.
export const PRIORITY_CLASS: Record<NoticePriority, string> = {
  urgent: "nprio nprio-urgent",
  important: "nprio nprio-important",
  normal: "nprio nprio-normal",
};

// The same three colours in the admin (Tailwind classes).
export const ADMIN_PRIORITY_CLASS: Record<NoticePriority, string> = {
  urgent: "border-alert-danger bg-alert-danger text-paper",
  important: "border-[#8a5a00] bg-[#fff3d6] text-[#5c3d00]",
  normal: "border-ink/40 bg-paper text-ink",
};

// Same limits as the API (NoticeTranslation.cs, Notice.cs).
export const NOTICE_TITLE_MAX = 200;
export const NOTICE_BODY_MAX = 2_000;
export const NOTICE_AREA_MAX = 200;
export const NOTICE_YEAR_MIN = 2000;
export const NOTICE_YEAR_MAX = 2100;
export const NOTICE_MAX_VALIDITY_DAYS = 366;

// Public lists.
export const ARCHIVE_PAGE_SIZE = 12;
export const HOME_NOTICES = 5;
// The API returns at most 50 active notices at once.
export const ACTIVE_LIMIT = 50;

// Notice ids are GUIDs; anything else can never be a notice.
export const NOTICE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The urgent banner remembers the notices closed in this browser session.
export const URGENT_DISMISSED_PREFIX = "urgent-notice-dismissed:";
