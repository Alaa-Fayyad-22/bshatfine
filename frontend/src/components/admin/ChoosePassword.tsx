"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { getMe } from "@/lib/auth-api";
import { LOGIN_PATH, safeReturnTo } from "@/lib/return-to";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { LogoutButton } from "./LogoutButton";

// "Choose your password": where a person lands after signing in with a
// temporary password. Outside the admin chrome and the admin guard (the guard
// sends people HERE), so it does its own session check.
export function ChoosePassword() {
  const t = useTranslations("Admin.password");
  const ta = useTranslations("Admin.auth");
  const locale = useLocale();
  const params = useSearchParams();
  const returnTo = safeReturnTo(params.get("returnTo"), locale);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMe().then((result) => {
      if (cancelled) return;
      if (!result.ok && result.error === "unauthorized") {
        window.location.replace(`/${locale}${LOGIN_PATH}`);
      } else if (result.ok && !result.data.mustChangePassword) {
        // Nothing to choose any more: carry on to where they were going.
        window.location.replace(returnTo);
      } else {
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [locale, returnTo]);

  return (
    <main id="main" className="grid flex-1 place-items-center p-4 md:p-10">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold md:text-3xl">{t("chooseTitle")}</h1>
        {ready ? (
          <>
            <p className="mt-3 text-ink/80">{t("chooseIntro")}</p>
            <div className="mt-6">
              <ChangePasswordForm
                forced
                // A full page load: nothing typed stays in memory.
                onChanged={() => window.location.replace(returnTo)}
              />
            </div>
          </>
        ) : (
          <p role="status" className="mt-6 text-ink/70">
            {ta("checking")}
          </p>
        )}
        <div className="mt-8 flex flex-wrap items-center gap-x-6 border-t border-line pt-4">
          <LogoutButton />
          <LocaleSwitcher />
        </div>
      </div>
    </main>
  );
}
