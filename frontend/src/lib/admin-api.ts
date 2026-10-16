// Admin API client. Runs in the BROWSER (the admin forms mutate data from
// client components), so it reads NEXT_PUBLIC_API_URL: Next.js only exposes
// env vars with that prefix to browser code. Public pages keep using the
// server-only API_URL in ./api.ts.
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
  // Relative to the API base; turn it into a URL with coverUrl().
  coverImageUrl: string | null;
  // Changes after every successful change to the article. Sent back with a PUT
  // so the API can refuse a save that would overwrite someone else's edit.
  version: number;
};

export { coverUrl } from "./cover";

export const BODY_MAX = 20_000;

export const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const COVER_MAX_BYTES = 10 * 1024 * 1024;

export type Paged<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type AdminNewsPage = Paged<AdminNewsDto>;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5246";

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

// `path` starts after /api/admin.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // A FormData body needs the browser to set its own multipart Content-Type
  // (with the boundary), so only JSON requests get the header.
  const headers: HeadersInit =
    init?.body instanceof FormData
      ? { ...init?.headers }
      : { "Content-Type": "application/json", ...init?.headers };
  // The session lives in an HttpOnly cookie, sent only with credentials: "include".
  const res = await fetch(`${API_URL}/api/admin${path}`, {
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
