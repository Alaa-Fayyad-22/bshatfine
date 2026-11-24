// Admin API client. Runs in the BROWSER (the admin forms mutate data from
// client components). It calls relative /api/admin/... paths on this site's
// own origin; src/proxy.ts forwards /api/* to the API, so the session cookie
// is first-party. Server code uses API_INTERNAL_URL in ./api.ts instead.
import type { EntryKind, EntryLanguage } from "@/config/entries";
import type { EventLanguage } from "@/config/events";
import type { NoticeLanguage } from "@/config/notices";
import { reportAuthFailure } from "./auth-api";
import { readRetryAfter } from "./rate-limit";

export const NEWS_STATUSES = ["Draft", "Published", "Archived"] as const;
export type NewsStatus = (typeof NEWS_STATUSES)[number];

export type TranslationDto = {
  language: "ar" | "en";
  title: string;
  body: string;
};

export type AdminNewsDto = {
  id: string;
  slug: string;
  status: NewsStatus;
  createdAt: string;
  updatedAt: string | null;
  publishedAt: string | null;
  translations: TranslationDto[];
  // A same-origin path (/api/files/...); pass it through coverUrl().
  coverImageUrl: string | null;
  // Changes after every successful change to the article. Sent back with a PUT
  // so the API can refuse a save that would overwrite someone else's edit.
  version: number;
};

export { coverUrl } from "./cover";

export const BODY_MAX = 20_000;

// Photos are checked, scaled down and re-encoded in the browser before they are
// sent: see ./prepare-image.

export type Paged<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type AdminNewsPage = Paged<AdminNewsDto>;

// Thrown for non-2xx answers. `detail` is the Problem Details message from the
// API (business-rule violations are 400s with the reason in it), if any.
// `retryAfter` is set for a 429: seconds to wait.
export class AdminApiError extends Error {
  constructor(
    public status: number,
    public detail: string | null,
    public retryAfter: number | null = null,
  ) {
    super(detail ?? `Request failed: ${status}`);
  }
}

// 413: the upload was too large. It comes either from this site's proxy (JSON)
// or from Vercel itself, as plain text ("FUNCTION_PAYLOAD_TOO_LARGE") that has
// no `detail`. Either way the forms show their own translated message
// ("the maximum is 4 MB") instead of a bare status code.
export function isPayloadTooLarge(e: unknown): boolean {
  return e instanceof AdminApiError && e.status === 413;
}

// `path` starts after /api/admin.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // A FormData body needs the browser to set its own multipart Content-Type
  // (with the boundary), so only JSON requests get the header.
  const headers: HeadersInit =
    init?.body instanceof FormData
      ? { ...init?.headers }
      : { "Content-Type": "application/json", ...init?.headers };
  // The session lives in an HttpOnly cookie, sent only with credentials: "include".
  const res = await fetch(`/api/admin${path}`, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    // 401 = session ended, 403 = not staff (or password change pending): the
    // admin guard reacts to either.
    reportAuthFailure(res.status);
    let detail: string | null = null;
    try {
      const problem = await res.json();
      if (typeof problem?.detail === "string") detail = problem.detail;
    } catch {
      // Not JSON (a 403 has an empty body): fall back to the status code.
    }
    throw new AdminApiError(res.status, detail, res.status === 429 ? readRetryAfter(res) : null);
  }

  // 204 (delete) has no body.
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---------- News ----------
// `status` is filtered by the API before paging, so the counts are per filter.
export function listAdminNews(
  page = 1,
  pageSize = 20,
  status?: NewsStatus,
): Promise<AdminNewsPage> {
  const q = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (status) q.set("status", status);
  return request(`/news?${q}`);
}

// Drafts only; the API answers 400 (with a reason) for anything else, and the
// cover photo goes with the article. 204 has no body.
export async function deleteNews(id: string): Promise<void> {
  await request<void>(`/news/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// null when the article does not exist.
export async function getAdminNews(id: string): Promise<AdminNewsDto | null> {
  try {
    return await request<AdminNewsDto>(`/news/${encodeURIComponent(id)}`);
  } catch (e) {
    if (e instanceof AdminApiError && e.status === 404) return null;
    throw e;
  }
}

export function createNews(translations: TranslationDto[]): Promise<AdminNewsDto> {
  return request("/news", { method: "POST", body: JSON.stringify({ translations }) });
}

export function updateNews(
  id: string,
  translations: TranslationDto[],
  version: number,
): Promise<AdminNewsDto> {
  return request(`/news/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ translations, version }),
  });
}

export function publishNews(id: string): Promise<AdminNewsDto> {
  return request(`/news/${encodeURIComponent(id)}/publish`, { method: "POST" });
}

export function archiveNews(id: string): Promise<AdminNewsDto> {
  return request(`/news/${encodeURIComponent(id)}/archive`, { method: "POST" });
}

// Archived -> Published; the API keeps the original publishedAt and slug.
export function republishNews(id: string): Promise<AdminNewsDto> {
  return request(`/news/${encodeURIComponent(id)}/republish`, { method: "POST" });
}

// Sends the image as multipart/form-data, field "file".
export function uploadNewsCover(id: string, file: File): Promise<AdminNewsDto> {
  const body = new FormData();
  body.append("file", file);
  return request(`/news/${encodeURIComponent(id)}/cover`, { method: "POST", body });
}

export function removeNewsCover(id: string): Promise<AdminNewsDto> {
  return request(`/news/${encodeURIComponent(id)}/cover`, { method: "DELETE" });
}

// ---------- Entries: history, projects, places, services (Admins and Editors) ----------
// What each kind allows lives in src/config/entries.ts.

export type EntryTranslationDto = {
  language: EntryLanguage;
  title: string;
  summary: string;
  // Markdown; optional (may be empty).
  body: string;
};

export type AdminEntryDto = {
  id: string;
  kind: EntryKind;
  category: string | null;
  status: string | null;
  year: number | null;
  isPublished: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string | null;
  publishedAt: string | null;
  translations: EntryTranslationDto[];
  coverImageUrl: string | null;
  // Changes after every successful change; sent back with a PUT.
  version: number;
};

// The fields that depend on the kind: null for the ones it does not use.
export type EntryDetails = {
  category: string | null;
  status: string | null;
  year: number | null;
};

// In display order.
export const listAdminEntries = (kind: EntryKind): Promise<AdminEntryDto[]> =>
  request(`/entries?kind=${kind}`);

// null when the entry does not exist (any more).
export async function getAdminEntry(id: string): Promise<AdminEntryDto | null> {
  try {
    return await request<AdminEntryDto>(`/entries/${encodeURIComponent(id)}`);
  } catch (e) {
    if (e instanceof AdminApiError && e.status === 404) return null;
    throw e;
  }
}

// Added at the end of its kind's list.
export const createEntry = (
  kind: EntryKind,
  translations: EntryTranslationDto[],
  details: EntryDetails,
): Promise<AdminEntryDto> =>
  request("/entries", { method: "POST", body: JSON.stringify({ kind, translations, ...details }) });

// The languages sent BECOME the entry's languages: always send every language
// the form has, or the missing one is deleted.
export const updateEntry = (
  id: string,
  translations: EntryTranslationDto[],
  details: EntryDetails,
  version: number,
): Promise<AdminEntryDto> =>
  request(`/entries/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ translations, ...details, version }),
  });

// Publishing needs an Arabic text (the API says so otherwise).
export const publishEntry = (id: string): Promise<AdminEntryDto> =>
  request(`/entries/${encodeURIComponent(id)}/publish`, { method: "POST" });
export const unpublishEntry = (id: string): Promise<AdminEntryDto> =>
  request(`/entries/${encodeURIComponent(id)}/unpublish`, { method: "POST" });

// `ids` is EVERY id of that kind, in the new order. Returns the reordered list.
export const reorderEntries = (kind: EntryKind, ids: string[]): Promise<AdminEntryDto[]> =>
  request(`/entries/order?kind=${kind}`, { method: "PUT", body: JSON.stringify({ ids }) });

export function uploadEntryCover(id: string, file: File): Promise<AdminEntryDto> {
  const body = new FormData();
  body.append("file", file);
  return request(`/entries/${encodeURIComponent(id)}/cover`, { method: "POST", body });
}

export const removeEntryCover = (id: string): Promise<AdminEntryDto> =>
  request(`/entries/${encodeURIComponent(id)}/cover`, { method: "DELETE" });

// Unpublished entries only (the API answers 400 otherwise); the cover goes too.
export async function deleteEntry(id: string): Promise<void> {
  await request<void>(`/entries/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ---------- Events (Admins and Editors) ----------
// Dates go OUT as ISO strings with Beirut's offset (src/lib/event-time.ts,
// beirutToIso) and come back in UTC ("...Z").

export type EventTranslationDto = {
  language: EventLanguage;
  title: string;
  summary: string;
  // Optional (may be empty). Body is Markdown.
  body: string;
  location: string;
  organizer: string;
};

export type AdminEventDto = {
  id: string;
  category: string;
  startsAt: string;
  // All-day events: the start of the LAST day.
  endsAt: string | null;
  isAllDay: boolean;
  // When the event moves to "Past events".
  finishesAt: string;
  mapUrl: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string | null;
  publishedAt: string | null;
  translations: EventTranslationDto[];
  coverImageUrl: string | null;
  // Changes after every successful change; sent back with a PUT.
  version: number;
};

export type EventInput = {
  translations: EventTranslationDto[];
  category: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isAllDay: boolean;
  mapUrl: string | null;
};

// Newest start first.
export function listAdminEvents(page = 1, pageSize = 20): Promise<Paged<AdminEventDto>> {
  const q = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return request(`/events?${q}`);
}

// null when the event does not exist (any more).
export async function getAdminEvent(id: string): Promise<AdminEventDto | null> {
  try {
    return await request<AdminEventDto>(`/events/${encodeURIComponent(id)}`);
  } catch (e) {
    if (e instanceof AdminApiError && e.status === 404) return null;
    throw e;
  }
}

export const createEvent = (input: EventInput): Promise<AdminEventDto> =>
  request("/events", { method: "POST", body: JSON.stringify(input) });

// The languages sent BECOME the event's languages (a missing one is deleted).
export const updateEvent = (id: string, input: EventInput, version: number): Promise<AdminEventDto> =>
  request(`/events/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ ...input, version }),
  });

// Publishing needs an Arabic text (the API says so otherwise).
export const publishEvent = (id: string): Promise<AdminEventDto> =>
  request(`/events/${encodeURIComponent(id)}/publish`, { method: "POST" });
export const unpublishEvent = (id: string): Promise<AdminEventDto> =>
  request(`/events/${encodeURIComponent(id)}/unpublish`, { method: "POST" });

export function uploadEventCover(id: string, file: File): Promise<AdminEventDto> {
  const body = new FormData();
  body.append("file", file);
  return request(`/events/${encodeURIComponent(id)}/cover`, { method: "POST", body });
}

export const removeEventCover = (id: string): Promise<AdminEventDto> =>
  request(`/events/${encodeURIComponent(id)}/cover`, { method: "DELETE" });

// Unpublished events only (the API answers 400 otherwise); the cover goes too.
export async function deleteEvent(id: string): Promise<void> {
  await request<void>(`/events/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ---------- Notices (Admins and Editors) ----------
// Dates go OUT as ISO strings with Beirut's offset (beirutToIso) or null, and
// come back in UTC ("...Z"). `category` and `priority` are codes
// (src/config/notices.ts).

export type NoticeTranslationDto = {
  language: NoticeLanguage;
  title: string;
  // Optional (null or empty). Plain text.
  body: string | null;
  area: string | null;
};

export type AdminNoticeDto = {
  id: string;
  category: string;
  priority: string;
  validFrom: string | null;
  validUntil: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string | null;
  publishedAt: string | null;
  translations: NoticeTranslationDto[];
  // Changes after every successful change; sent back with a PUT.
  version: number;
};

export type NoticeInput = {
  translations: NoticeTranslationDto[];
  category: string;
  priority: string;
  validFrom: string | null;
  validUntil: string | null;
};

// Newest first (by creation). The API has no filters for this list: only paging.
export function listAdminNotices(page = 1, pageSize = 20): Promise<Paged<AdminNoticeDto>> {
  const q = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return request(`/notices?${q}`);
}

// null when the notice does not exist (any more).
export async function getAdminNotice(id: string): Promise<AdminNoticeDto | null> {
  try {
    return await request<AdminNoticeDto>(`/notices/${encodeURIComponent(id)}`);
  } catch (e) {
    if (e instanceof AdminApiError && e.status === 404) return null;
    throw e;
  }
}

export const createNotice = (input: NoticeInput): Promise<AdminNoticeDto> =>
  request("/notices", { method: "POST", body: JSON.stringify(input) });

// The languages sent BECOME the notice's languages (a missing one is deleted).
export const updateNotice = (id: string, input: NoticeInput, version: number): Promise<AdminNoticeDto> =>
  request(`/notices/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ ...input, version }),
  });

// Publishing needs an Arabic text (the API says so otherwise).
export const publishNotice = (id: string): Promise<AdminNoticeDto> =>
  request(`/notices/${encodeURIComponent(id)}/publish`, { method: "POST" });
export const unpublishNotice = (id: string): Promise<AdminNoticeDto> =>
  request(`/notices/${encodeURIComponent(id)}/unpublish`, { method: "POST" });

// Unpublished notices only (the API answers 400 otherwise).
export async function deleteNotice(id: string): Promise<void> {
  await request<void>(`/notices/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ---------- Contact details (Admin only) ----------
export type AdminSiteSettingsDto = {
  phone: string | null;
  secondaryPhone: string | null;
  email: string | null;
  addressAr: string | null;
  addressEn: string | null;
  openingHoursAr: string | null;
  openingHoursEn: string | null;
  mapUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  updatedAt: string | null;
  // null until the very first save.
  version: number | null;
};

export const getAdminSiteSettings = (): Promise<AdminSiteSettingsDto> => request("/site-settings");

export function updateSiteSettings(
  values: Omit<AdminSiteSettingsDto, "updatedAt" | "version">,
  version: number | null,
): Promise<AdminSiteSettingsDto> {
  return request("/site-settings", { method: "PUT", body: JSON.stringify({ ...values, version }) });
}

// ---------- Council (Admin only) ----------
export type AdminCouncilMemberDto = {
  id: string;
  nameAr: string;
  nameEn: string | null;
  positionAr: string;
  positionEn: string | null;
  photoUrl: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
  version: number;
};

export type CouncilMemberInput = {
  nameAr: string;
  nameEn: string;
  positionAr: string;
  positionEn: string;
};

export const COUNCIL_TEXT_MAX = 150;

export const listCouncil = (): Promise<AdminCouncilMemberDto[]> => request("/council");

// null when the member no longer exists.
export async function getCouncilMember(id: string): Promise<AdminCouncilMemberDto | null> {
  try {
    return await request<AdminCouncilMemberDto>(`/council/${encodeURIComponent(id)}`);
  } catch (e) {
    if (e instanceof AdminApiError && e.status === 404) return null;
    throw e;
  }
}

export const createCouncilMember = (input: CouncilMemberInput): Promise<AdminCouncilMemberDto> =>
  request("/council", { method: "POST", body: JSON.stringify(input) });

export const updateCouncilMember = (
  id: string,
  input: CouncilMemberInput,
  version: number,
): Promise<AdminCouncilMemberDto> =>
  request(`/council/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ ...input, version }),
  });

const councilAction = (id: string, action: string): Promise<AdminCouncilMemberDto> =>
  request(`/council/${encodeURIComponent(id)}/${action}`, { method: "POST" });
export const activateCouncilMember = (id: string) => councilAction(id, "activate");
export const deactivateCouncilMember = (id: string) => councilAction(id, "deactivate");

// `ids` is EVERY member's id in the new order. Returns the reordered list.
export const reorderCouncil = (ids: string[]): Promise<AdminCouncilMemberDto[]> =>
  request("/council/order", { method: "PUT", body: JSON.stringify({ ids }) });

export function uploadCouncilPhoto(id: string, file: File): Promise<AdminCouncilMemberDto> {
  const body = new FormData();
  body.append("file", file);
  return request(`/council/${encodeURIComponent(id)}/photo`, { method: "POST", body });
}

export const removeCouncilPhoto = (id: string): Promise<AdminCouncilMemberDto> =>
  request(`/council/${encodeURIComponent(id)}/photo`, { method: "DELETE" });

export async function deleteCouncilMember(id: string): Promise<void> {
  await request<void>(`/council/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ---------- Staff users (Admin only) ----------
export const STAFF_ROLES = ["Admin", "Editor"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export type StaffUserDto = {
  id: string;
  email: string;
  displayName: string;
  role: StaffRole;
  isActive: boolean;
  isLockedOut: boolean;
  mustChangePassword: boolean;
  createdAt: string;
};

// The temporary password is only ever in this object. Callers hand it to the
// one-time dialog and drop it; it is never stored.
export type TemporaryPasswordResult = { user: StaffUserDto; temporaryPassword: string };

export type UserFilter = {
  search: string;
  role: StaffRole | "";
  isActive: "" | "true" | "false";
  page: number;
  pageSize: number;
};

export function listUsers(f: UserFilter): Promise<Paged<StaffUserDto>> {
  const q = new URLSearchParams({ page: String(f.page), pageSize: String(f.pageSize) });
  if (f.search.trim()) q.set("search", f.search.trim());
  if (f.role) q.set("role", f.role);
  if (f.isActive) q.set("isActive", f.isActive);
  return request(`/users?${q}`);
}

export function createUser(input: {
  email: string;
  displayName: string;
  role: StaffRole;
}): Promise<TemporaryPasswordResult> {
  return request("/users", { method: "POST", body: JSON.stringify(input) });
}

export function updateUser(
  id: string,
  input: { displayName: string; role: StaffRole },
): Promise<StaffUserDto> {
  return request(`/users/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) });
}

function userAction<T = StaffUserDto>(id: string, action: string): Promise<T> {
  return request(`/users/${encodeURIComponent(id)}/${action}`, { method: "POST" });
}

export const disableUser = (id: string) => userAction(id, "disable");
export const enableUser = (id: string) => userAction(id, "enable");
export const forceLogoutUser = (id: string) => userAction(id, "force-logout");
export const unlockUser = (id: string) => userAction(id, "unlock");
export const resetUserPassword = (id: string) =>
  userAction<TemporaryPasswordResult>(id, "reset-password");

// ---------- Audit log (Admin only, read-only) ----------
export type AuditLogDto = {
  id: string;
  occurredAt: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  // A JSON string, or null.
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

export type AuditFilter = {
  userEmail: string;
  action: string;
  entityType: string;
  // ISO instants (UTC), or "".
  from: string;
  to: string;
  page: number;
  pageSize: number;
};

export function listAudit(f: AuditFilter): Promise<Paged<AuditLogDto>> {
  const q = new URLSearchParams({ page: String(f.page), pageSize: String(f.pageSize) });
  if (f.userEmail.trim()) q.set("userEmail", f.userEmail.trim());
  if (f.action) q.set("action", f.action);
  if (f.entityType) q.set("entityType", f.entityType);
  if (f.from) q.set("from", f.from);
  if (f.to) q.set("to", f.to);
  return request(`/audit?${q}`);
}
