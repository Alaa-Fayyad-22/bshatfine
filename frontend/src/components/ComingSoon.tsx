import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { PlannedNavKey } from "@/config/navigation";

// Shared placeholder for pages that are planned but not built yet.
export function ComingSoon({ section }: { section: PlannedNavKey }) {
  const t = useTranslations("ComingSoon");
  const tn = useTranslations("Nav");

  return (
    <div className="bg-sand">
      <div className="page-container section-y">
        <p className="inline-flex items-center gap-3 text-base font-semibold text-cedar">
          <span aria-hidden className="h-0.5 w-10 bg-gold" />
          {t("title")}
        </p>
        <h1 className="mt-5 text-3xl font-bold md:text-4xl">{tn(section)}</h1>
        <p className="mt-4 max-w-prose text-ink/80">{t("text")}</p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center rounded-control border border-cedar px-5 font-medium text-cedar hover:bg-cedar hover:text-ivory"
        >
          {t("backHome")}
        </Link>
      </div>
    </div>
  );
}
