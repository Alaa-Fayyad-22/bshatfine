// Helpers for showing audit log entries. The wording lives in messages/*.json
// (Admin.audit); this file only decides WHICH message an entry uses.

// API action code -> key under Admin.audit.actions. (next-intl keys cannot
// contain dots, so the codes are mapped to camelCase keys.)
export const AUDIT_ACTIONS = {
  "auth.login.succeeded": "loginSucceeded",
  "auth.login.failed": "loginFailed",
  "auth.login.locked_out": "loginLockedOut",
  "auth.logout": "logout",
  "auth.password.changed": "passwordChanged",
  "auth.registered": "registered",
  "auth.register.duplicate_email": "registerDuplicate",
  "news.created": "newsCreated",
  "news.updated": "newsUpdated",
  "news.published": "newsPublished",
  "news.archived": "newsArchived",
  "news.republished": "newsRepublished",
  "news.cover.set": "newsCoverSet",
  "news.cover.removed": "newsCoverRemoved",
  "user.created": "userCreated",
  "user.updated": "userUpdated",
  "user.role_changed": "userRoleChanged",
  "user.disabled": "userDisabled",
  "user.enabled": "userEnabled",
  "user.password_reset": "userPasswordReset",
  "user.forced_logout": "userForcedLogout",
  "user.unlocked": "userUnlocked",
} as const;

export type AuditActionCode = keyof typeof AUDIT_ACTIONS;

export function actionKey(code: string): (typeof AUDIT_ACTIONS)[AuditActionCode] | null {
  return Object.hasOwn(AUDIT_ACTIONS, code) ? AUDIT_ACTIONS[code as AuditActionCode] : null;
}

// Entity types the API writes today.
export const AUDIT_ENTITY_TYPES = ["News", "User"] as const;

export const LOGIN_FAIL_REASONS = {
  unknown_email: "unknownEmail",
  inactive: "inactive",
  wrong_password: "wrongPassword",
} as const;

// "details" is a JSON string the API wrote; anything unexpected gives null.
export function parseDetails(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

// Never show anything that could be a secret, whatever a future action stores.
const SECRET_KEY = /pass|secret|token|hash|key|code/i;

export function plainDetails(details: Record<string, unknown>): [string, string][] {
  return Object.entries(details)
    .filter(([k, v]) => !SECRET_KEY.test(k) && ["string", "number", "boolean"].includes(typeof v))
    .map(([k, v]) => [k, String(v)]);
}

// The API stores UTC. If a timestamp ever arrives without a zone, treat it as UTC
// instead of letting the browser read it as local time.
export function parseUtc(iso: string): Date {
  return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : `${iso}Z`);
}

// <input type="date"> value ("2026-10-15") -> start / end of that LOCAL day, as
// an ISO instant for the API (its "to" filter is inclusive).
export function dayStartIso(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}
export function dayEndIso(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}
