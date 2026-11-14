import { useTranslations } from "next-intl";
import { Hero } from "@/components/site/Hero";
import { photoSrc } from "@/components/site/Photo";
import { Link } from "@/i18n/navigation";
import type { PlannedNavKey } from "@/config/navigation";

// Shared placeholder for pages that are planned but not built yet.
export function ComingSoon({ section }: { section: PlannedNavKey }) {
  const t = useTranslations("ComingSoon");
  const tn = useTranslations("Nav");
  const tp = useTranslations("Pages");

  return (
    <>
      <Hero
        image={photoSrc("aerial")}
        alt={tp("planned.alt")}
        crumbs={[{ label: tn(section) }]}
        kicker={t("title")}
        title={tn(section)}
      />
      <section className="section">
        <div className="wrap">
          <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 22 }}>
            <p className="lead">{t("text")}</p>
            <Link className="tlink" href="/" style={{ alignSelf: "flex-start" }}>
              {t("backHome")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
