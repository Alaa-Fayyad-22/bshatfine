"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { isAdmin } from "@/lib/auth-api";
import { useAdminUser } from "./AdminGuard";

// Wraps pages only Admins may use (users, audit). The API enforces this too
// (Editors get 403); this is what an Editor who opens the URL sees. Nothing
// inside is rendered, so nothing is fetched, for anyone else.
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Admin.forbidden");
  const me = useAdminUser();

  if (isAdmin(me)) return <>{children}</>;
  return (
    <div role="alert" className="max-w-prose">
      <h1 className="text-2xl font-bold md:text-3xl">{t("title")}</h1>
      <p className="mt-4 text-ink/80">{t("body")}</p>
      <Link
        href="/admin/news"
        className="mt-4 inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
      >
        {t("back")}
      </Link>
    </div>
  );
}
