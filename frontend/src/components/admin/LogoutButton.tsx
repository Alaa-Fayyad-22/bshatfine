"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { logout } from "@/lib/auth-api";
import { LOGIN_PATH } from "@/lib/return-to";

// Ends the session on the API, then goes to the login page. If the API could
// not be reached the session may still be alive, so we stay and say so.
export function LogoutButton({ className }: { className?: string }) {
  const t = useTranslations("Admin.auth");
  const locale = useLocale();
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");

  async function onClick() {
    if (state === "busy") return;
    setState("busy");
    const result = await logout();
    // 401 means there was no session any more: same outcome as a clean logout.
    if (result.ok || result.error === "unauthorized") {
      // Full page load: drops every admin page Next keeps alive in memory.
      window.location.replace(`/${locale}${LOGIN_PATH}`);
    } else {
      setState("error");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={state === "busy"}
        className={
          className ??
          "inline-flex min-h-11 items-center justify-center rounded-control border border-cedar bg-ivory px-4 font-semibold text-cedar disabled:cursor-not-allowed disabled:opacity-50"
        }
      >
        {state === "busy" ? t("loggingOut") : t("logout")}
      </button>
      {state === "error" && (
        <p role="alert" className="mt-2 text-sm text-alert-danger">
          {t("logoutError")}
        </p>
      )}
    </div>
  );
}
