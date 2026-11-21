"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { isAdmin } from "@/lib/auth-api";
import { useAdminUser } from "./AdminGuard";

// Admin sections. Add future sections (events, services...) here.
// `adminOnly` sections are left out of an Editor's navigation.
const sections = [
  { key: "news", href: "/admin/news", adminOnly: false },
  { key: "content", href: "/admin/content", adminOnly: false },
  { key: "contact", href: "/admin/contact", adminOnly: true },
  { key: "council", href: "/admin/council", adminOnly: true },
  { key: "users", href: "/admin/users", adminOnly: true },
  { key: "audit", href: "/admin/audit", adminOnly: true },
] as const;

export function AdminNav() {
  const t = useTranslations("Admin");
  const pathname = usePathname();
  const admin = isAdmin(useAdminUser());

  return (
    <nav aria-label={t("navLabel")}>
      <ul className="flex flex-wrap gap-1 md:flex-col">
        {sections
          .filter((s) => admin || !s.adminOnly)
          .map(({ key, href }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={key}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center rounded-control px-3 font-medium ${
                    active ? "bg-paper text-pine" : "hover:bg-paper/60"
                  }`}
                >
                  {t(`nav.${key}`)}
                </Link>
              </li>
            );
          })}
      </ul>
    </nav>
  );
}
