// Auth API client. Runs in the BROWSER. The API keeps the session in an
// HttpOnly cookie (bsh.session) that JavaScript can never read, so nothing here
// stores a token, a password or any session data: every call just sends the
// cookie along with `credentials: "include"`.
//
// The address is relative (/api/auth/...): the browser only talks to this
// site's own origin and src/proxy.ts forwards /api/* to the API, so the
// session cookie is first-party.
//
// None of these functions throws. They return a result, so callers handle
// every case (wrong password, lockout, offline, ...) explicitly.
import { FALLBACK_RETRY_SECONDS, readRetryAfter } from "./rate-limit";

export type Me = {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
  mfaVerified: boolean;
};

// unauthorized: 401 (wrong credentials / code, or no session)
// forbidden:    403
// locked:       429, the ACCOUNT is locked after too many failed passwords
// rateLimited:  429, too many requests from this address (`retryAfter` seconds)
// network:      the API could not be reached at all
// server:       5xx, or an answer we cannot understand
// unknown:      any other status (400 ...); `detail` is the API's message, if any
export type AuthErrorKind =
  | "unauthorized"
  | "forbidden"
  | "locked"
  | "rateLimited"
  | "network"
  | "server"
  | "unknown";

export type AuthResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AuthErrorKind; retryAfter?: number; detail?: string };

// The account-lockout 429 and the rate-limiter 429 look alike. The lockout is
// the only one whose message starts like this (see AuthEndpoints.TooManyAttempts).
const LOCKOUT_DETAIL = "Too many failed attempts";

async function problemDetail(res: Response): Promise<string | undefined> {
  try {
    const problem = await res.json();
    return typeof problem?.detail === "string" ? problem.detail : undefined;
  } catch {
    return undefined; // not JSON, or an empty body
  }
}

async function failure<T>(res: Response): Promise<AuthResult<T>> {
  if (res.status === 429) {
    const detail = await problemDetail(res);
    if (detail?.startsWith(LOCKOUT_DETAIL)) return { ok: false, error: "locked" };
    return {
      ok: false,
      error: "rateLimited",
      retryAfter: readRetryAfter(res) ?? FALLBACK_RETRY_SECONDS,
    };
  }
  if (res.status === 401) return { ok: false, error: "unauthorized" };
  if (res.status === 403) return { ok: false, error: "forbidden" };
  if (res.status >= 500) return { ok: false, error: "server" };
  const detail = await problemDetail(res);
  return detail ? { ok: false, error: "unknown", detail } : { ok: false, error: "unknown" };
}

async function call<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
  parse: (json: unknown) => T | null,
): Promise<AuthResult<T>> {
  let res: Response;
  try {
    res = await fetch(`/api/auth${path}`, {
      method: init.method,
      credentials: "include",
      cache: "no-store",
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    return { ok: false, error: "network" };
  }
  if (!res.ok) return failure<T>(res);

  let json: unknown = null;
  if (res.status !== 204) {
    try {
      json = await res.json();
    } catch {
      return { ok: false, error: "server" };
    }
  }
  const data = parse(json);
  return data === null ? { ok: false, error: "server" } : { ok: true, data };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

// The password is only ever in this request body; it is not kept or logged.
export function login(
  email: string,
  password: string,
): Promise<AuthResult<{ requiresTwoFactor: boolean }>> {
  return call("/login", { method: "POST", body: { email, password } }, (j) =>
    isRecord(j) && typeof j.requiresTwoFactor === "boolean"
      ? { requiresTwoFactor: j.requiresTwoFactor }
      : null,
  );
}

export function loginTwoFactor(code: string): Promise<AuthResult<{ signedIn: true }>> {
  return call("/login/2fa", { method: "POST", body: { code } }, (j) =>
    isRecord(j) && j.signedIn === true ? { signedIn: true as const } : null,
  );
}

export function logout(): Promise<AuthResult<{ loggedOut: true }>> {
  // 204 No Content: there is no body to read, success is the status alone.
  return call("/logout", { method: "POST" }, () => ({ loggedOut: true as const }));
}

// Ends a forced password change too. 204: the session cookie is refreshed and
// there is no body. Both passwords are only ever in this request body.
export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<AuthResult<{ changed: true }>> {
  return call("/change-password", { method: "POST", body: { currentPassword, newPassword } }, () => ({
    changed: true as const,
  }));
}

// Several callers may ask at the same moment (React Strict Mode runs effects
// twice in development). They share one request instead of sending two.
let pendingMe: Promise<AuthResult<Me>> | null = null;

export function getMe(): Promise<AuthResult<Me>> {
  pendingMe ??= call<Me>("/me", { method: "GET" }, (j) =>
    isRecord(j) &&
    typeof j.id === "string" &&
    typeof j.email === "string" &&
    typeof j.displayName === "string" &&
    Array.isArray(j.roles) &&
    j.roles.every((r) => typeof r === "string")
      ? {
          id: j.id,
          email: j.email,
          displayName: j.displayName,
          roles: j.roles as string[],
          mustChangePassword: j.mustChangePassword === true,
          twoFactorEnabled: j.twoFactorEnabled === true,
          mfaVerified: j.mfaVerified === true,
        }
      : null,
  ).finally(() => {
    pendingMe = null;
  });
  return pendingMe;
}

// Staff = Admin or Editor.
export function isStaff(me: Me): boolean {
  return me.roles.includes("Admin") || me.roles.includes("Editor");
}

export function isAdmin(me: Me): boolean {
  return me.roles.includes("Admin");
}

// Any admin API call that comes back 401 (session ended) or 403 (no staff role)
// reports it here; the admin guard listens and reacts (redirect / access denied)
// no matter which component made the call.
type AuthFailureListener = (status: 401 | 403) => void;
const listeners = new Set<AuthFailureListener>();

export function onAuthFailure(listener: AuthFailureListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function reportAuthFailure(status: number): void {
  if (status === 401 || status === 403) listeners.forEach((l) => l(status));
}
