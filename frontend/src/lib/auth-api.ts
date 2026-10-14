// Auth API client. Runs in the BROWSER. The API keeps the session in an
// HttpOnly cookie (bsh.session) that JavaScript can never read, so nothing here
// stores a token, a password or any session data: every call just sends the
// cookie along with `credentials: "include"`.
//
// None of these functions throws. They return a result, so callers handle
// every case (wrong password, lockout, offline, ...) explicitly.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5246";

export type Me = {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  twoFactorEnabled: boolean;
  mfaVerified: boolean;
};

// unauthorized: 401 (wrong credentials / code, or no session)
// forbidden:    403
// locked:       429 (too many failed attempts)
// network:      the API could not be reached at all
// server:       5xx, or an answer we cannot understand
// unknown:      any other status (400 ...)
export type AuthErrorKind =
  | "unauthorized"
  | "forbidden"
  | "locked"
  | "network"
  | "server"
  | "unknown";

export type AuthResult<T> = { ok: true; data: T } | { ok: false; error: AuthErrorKind };

function kindOf(status: number): AuthErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 429) return "locked";
  if (status >= 500) return "server";
  return "unknown";
}

async function call<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
  parse: (json: unknown) => T | null,
): Promise<AuthResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/auth${path}`, {
      method: init.method,
      credentials: "include",
      cache: "no-store",
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    return { ok: false, error: "network" };
  }
  if (!res.ok) return { ok: false, error: kindOf(res.status) };

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
