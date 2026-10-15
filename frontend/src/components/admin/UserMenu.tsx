"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useAdminUser } from "./AdminGuard";
import { LogoutButton } from "./LogoutButton";

const PASSWORD_HREF = "/admin/account/password";

// Who is signed in, and the way out. Sits in the admin sidebar/header.
export function UserMenu() {
  const t = useTranslations("Admin.auth");
  const tp = useTranslations("Admin.password");
  const me = useAdminUser();
  const pathname = usePathname();

  return (
    <div role="group" aria-label={t("accountLabel")} className="flex flex-col gap-2">
      <p className="text-sm text-ink/70">
        {t("signedInAs")}
        <span className="block text-base font-semibold break-words text-ink">{me.displayName}</span>
      </p>
      <div className="flex flex-wrap items-center gap-x-4">
        <Link
          href={PASSWORD_HREF}
          aria-current={pathname === PASSWORD_HREF ? "page" : undefined}
          className="inline-flex min-h-11 items-center font-medium underline underline-offset-4"
        >
          {tp("menu")}
        </Link>
        <LogoutButton />
      </div>
    </div>
  );
}
