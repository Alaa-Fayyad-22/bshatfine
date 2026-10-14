"use client";

import { useTranslations } from "next-intl";
import { useAdminUser } from "./AdminGuard";
import { LogoutButton } from "./LogoutButton";

// Who is signed in, and the way out. Sits in the admin sidebar/header.
export function UserMenu() {
  const t = useTranslations("Admin.auth");
  const me = useAdminUser();

  return (
    <div role="group" aria-label={t("accountLabel")} className="flex flex-col gap-2">
      <p className="text-sm text-ink/70">
        {t("signedInAs")}
        <span className="block text-base font-semibold break-words text-ink">{me.displayName}</span>
      </p>
      <div>
        <LogoutButton />
      </div>
    </div>
  );
}
