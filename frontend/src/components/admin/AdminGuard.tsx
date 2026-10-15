"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getMe, isStaff, onAuthFailure, type AuthErrorKind, type Me } from "@/lib/auth-api";
import { CHOOSE_PASSWORD_PATH, LOGIN_PATH } from "@/lib/return-to";
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

  // A temporary password must be replaced before anything else in the admin
  // works (the API answers every /api/admin call with an empty 403 until then).
  const toChoosePassword = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    setState({ status: "redirecting" });
    const query = new URLSearchParams({
      returnTo: window.location.pathname + window.location.search,
    });
    window.location.replace(`/${locale}${CHOOSE_PASSWORD_PATH}?${query}`);
  }, [locale]);

  const check = useCallback(async () => {
    const result = await getMe();
    if (result.ok) {
      if (result.data.mustChangePassword) toChoosePassword();
      else {
        setState(
          isStaff(result.data) ? { status: "ready", me: result.data } : { status: "denied" },
        );
      }
    } else if (result.error === "unauthorized") {
      toLogin(false);
    } else if (result.error === "forbidden") {
      setState({ status: "denied" });
    } else {
      setState({ status: "error", kind: result.error });
    }
  }, [toLogin, toChoosePassword]);

  // One /me call when the admin area opens.
  useEffect(() => {
    leaving.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async: state is set after the request
    void check();
  }, [check]);

  // An admin API call elsewhere on the page came back 401 / 403. A 403 has an
  // empty body, so ask /me why: a pending password change, or really no access.
  useEffect(
    () =>
      onAuthFailure((status) => {
        if (status === 401) return toLogin(true);
        void getMe().then((result) => {
          if (result.ok && result.data.mustChangePassword) toChoosePassword();
          else setState({ status: "denied" });
        });
      }),
    [toLogin, toChoosePassword],
  );

  // A tab coming back into view asks the API again, so a session that an admin
  // ended meanwhile (forced logout, disabled account) is noticed at once. There
  // is deliberately no timer: polling would keep an idle session alive.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void getMe().then((result) => {
        if (!result.ok && result.error === "unauthorized") toLogin(true);
        else if (result.ok && result.data.mustChangePassword) toChoosePassword();
      });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [toLogin, toChoosePassword]);

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
