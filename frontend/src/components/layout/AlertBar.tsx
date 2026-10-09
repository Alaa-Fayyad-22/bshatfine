import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { siteAlert } from "@/lib/alert";

export function AlertBar() {
  const t = useTranslations("Alert");
  const locale = useLocale() as Locale;

  if (!siteAlert) return null;

  const dotColor =
    siteAlert.level === "danger" ? "bg-alert-danger" : "bg-alert-warn";

  return (
    <aside
      aria-label={t("label")}
      className="border-b border-hairline bg-sand text-ink"
    >
      <div className="page-container flex h-11 items-center gap-3 text-sm">
        <span
          aria-hidden
          className={`size-2.5 shrink-0 rounded-full ${dotColor}`}
        />
        <p className="min-w-0 flex-1 truncate">
          <span className="sr-only">{t(siteAlert.level)}: </span>
          {siteAlert.text[locale]}
        </p>
        <Link
          href={siteAlert.href}
          className="inline-flex min-h-11 shrink-0 items-center font-semibold underline underline-offset-4"
        >
          {t("details")}
        </Link>
      </div>
    </aside>
  );
}
