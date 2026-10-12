"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

// Admin sections. Add future sections (events, services...) here.
const sections = [{ key: "news", href: "/admin/news" }] as const;

export function AdminNav() {
  const t = useTranslations("Admin");
  const pathname = usePathname();

  return (
    <nav aria-label={t("navLabel")}>
      <ul className="flex gap-1 md:flex-col">
        {sections.map(({ key, href }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-control px-3 font-medium ${
                  active ? "bg-ivory text-cedar" : "hover:bg-ivory/60"
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
