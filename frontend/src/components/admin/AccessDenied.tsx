"use client";

import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { Link } from "@/i18n/navigation";
import { LogoutButton } from "./LogoutButton";

// Shown to a signed-in user who is neither Admin nor Editor (or whose admin
// calls come back 403). No admin data is loaded behind it.
export function AccessDenied() {
  const t = useTranslations("Admin.auth");
  const ta = useTranslations("Admin");

  return (
    <main id="main" className="grid flex-1 place-items-center p-4 md:p-10">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold md:text-3xl">{t("deniedTitle")}</h1>
        <p className="mt-4 text-ink/80">{t("deniedBody")}</p>
        <div className="mt-8 flex flex-wrap items-start gap-3">
          <LogoutButton />
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-6">
          <Link href="/" className="inline-flex min-h-11 items-center underline underline-offset-4">
            {ta("backToSite")}
          </Link>
          <LocaleSwitcher />
        </div>
      </div>
    </main>
  );
}
