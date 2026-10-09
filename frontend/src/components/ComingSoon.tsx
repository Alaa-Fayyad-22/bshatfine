import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type Section = "news" | "events" | "services" | "contact" | "login";

// Shared placeholder for pages that are built in later milestones.
export function ComingSoon({ section }: { section: Section }) {
  const t = useTranslations("ComingSoon");
  const tn = useTranslations("Nav");

  return (
    <div className="section-y">
      <div className="page-container">
        <p className="text-base font-medium text-cedar">{tn(section)}</p>
        <h1 className="mt-2 text-4xl font-bold md:text-5xl">{t("title")}</h1>
        <p className="mt-4 max-w-prose">{t("text")}</p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center underline underline-offset-4"
        >
          {t("backHome")}
        </Link>
      </div>
    </div>
  );
}
