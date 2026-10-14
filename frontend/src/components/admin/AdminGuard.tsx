"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getMe, isStaff, onAuthFailure, type AuthErrorKind, type Me } from "@/lib/auth-api";
import { LOGIN_PATH } from "@/lib/return-to";
import { AccessDenied } from "./AccessDenied";

type State =
  | { status: "loading" }
  | { status: "ready"; me: Me }
  | { status: "denied" }
  | { status: "error"; kind: AuthErrorKind }
  | { status: "redirecting" };

const UserContext = createContext<Me | null>(null);

export function useAdminUser(): Me {
  const me = useContext(UserContext);
  if (!me) throw new Error("useAdminUser must be used inside <AdminGuard>");
  return me;
}

// Wraps the whole admin area. Nothing inside is rendered (so nothing is
// fetched) until GET /api/auth/me says the visitor is staff. The session lives
// in an HttpOnly cookie, so this check is the only way the page can know.
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Admin.auth");
  const locale = useLocale();
  const [state, setState] = useState<State>({ status: "loading" });
  const leaving = useRef(false);

  const toLogin = useCallback(
    (expired: boolean) => {
      if (leaving.current) return;
      leaving.current = true;
      setState({ status: "redirecting" });
      const query = new URLSearchParams({
        returnTo: window.location.pathname + window.location.search,
      });
      if (expired) query.set("expired", "1");
      // Full page load: the admin pages Next keeps alive in memory (with data
      // on them) are dropped, so nothing from the old session stays reachable.
      window.location.replace(`/${locale}${LOGIN_PATH}?${query}`);
    },
    [locale],
  );

  const check = useCallback(async () => {
    const result = await getMe();
    if (result.ok) {
      setState(isStaff(result.data) ? { status: "ready", me: result.data } : { status: "denied" });
    } else if (result.error === "unauthorized") {
      toLogin(false);
    } else if (result.error === "forbidden") {
      setState({ status: "denied" });
    } else {
      setState({ status: "error", kind: result.error });
    }
  }, [toLogin]);

  // One /me call when the admin area opens.
  useEffect(() => {
    leaving.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async: state is set after the request
    void check();
  }, [check]);

  // An admin API call elsewhere on the page came back 401 / 403.
  useEffect(
    () =>
      onAuthFailure((status) => {
        if (status === 401) toLogin(true);
        else setState({ status: "denied" });
      }),
    [toLogin],
  );

  // Back/forward can restore a frozen copy of the page (bfcache) with admin data
  // on it, possibly after logging out. Hide it and ask the API again.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      leaving.current = false;
      setState({ status: "loading" });
      void check();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [check]);

  if (state.status === "ready") {
    return <UserContext.Provider value={state.me}>{children}</UserContext.Provider>;
  }
  if (state.status === "denied") return <AccessDenied />;

  return (
    <main id="main" className="grid flex-1 place-items-center p-4 md:p-10">
      {state.status === "error" ? (
        <div role="alert" className="max-w-prose text-center">
          <p>{state.kind === "network" ? t("network") : t("server")}</p>
          <button
            type="button"
            onClick={() => {
              setState({ status: "loading" });
              void check();
            }}
            className="mt-3 min-h-11 font-semibold underline underline-offset-4"
          >
            {t("retry")}
          </button>
        </div>
      ) : (
        <p role="status" className="text-ink/70">
          {t("checking")}
        </p>
      )}
    </main>
  );
}
