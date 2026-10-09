"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

// Links to the *same* page in the other language. usePathname() returns the
// path without the locale prefix, and <Link locale> puts the other prefix on.
export function LocaleSwitcher() {
  const t = useTranslations("Language");
  const pathname = usePathname();
  const target = t("code") as Locale;

  return (
    <Link
      href={pathname}
      locale={target}
      lang={target}
      hrefLang={target}
      aria-label={t("switchLabel")}
      className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 font-medium underline-offset-4 hover:underline"
    >
      {t("switchTo")}
    </Link>
  );
}
