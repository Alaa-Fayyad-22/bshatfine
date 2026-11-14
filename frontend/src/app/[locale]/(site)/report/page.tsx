import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { hasLocale, useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Hero } from "@/components/site/Hero";
import { photoSrc } from "@/components/site/Photo";
import { SiteForm } from "@/components/site/SiteForm";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/site-meta";
import { getSettings } from "@/lib/site-settings";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/report">): Promise<Metadata> {
  return pageMetadata((await params).locale, "report");
}

const CATEGORIES = ["roads", "lighting", "waste", "water", "other"] as const;

// PLACEHOLDER: the sample "recent reports" of the approved design.
const RECENT = [
  { key: "light", status: "resolved", tone: "st-done" },
  { key: "pothole", status: "inProgress", tone: "st-on" },
  { key: "bin", status: "received", tone: "st-plan" },
] as const;

export default async function Page({ params }: PageProps<"/[locale]/report">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Report");
  const tn = await getTranslations("Nav");
  const tf = await getTranslations("Forms");

  return (
    <>
      <Hero
        image={photoSrc("golden")}
        alt={t("hero.alt")}
        crumbs={[{ label: tn("services"), href: "/services" }, { label: tn("report") }]}
        kicker={t("hero.kicker")}
        title={t("hero.title")}
      />

      <section className="section">
        <div className="wrap split" style={{ alignItems: "flex-start" }}>
          {/* No back end yet: submitting only shows the "coming soon" message. */}
          <SiteForm className="main form panel" message={tf("comingSoon")}>
            <div className="field">
              <span className="legend">{t("form.about")}</span>
              <div className="chips" role="radiogroup" aria-label={t("form.category")}>
                {CATEGORIES.map((cat, i) => (
                  <label key={cat}>
                    <input type="radio" name="cat" value={cat} defaultChecked={i === 0} />
                    <span>{t(`form.categories.${cat}`)}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="r-loc">{t("form.location")}</label>
              <input id="r-loc" type="text" placeholder={t("form.locationPlaceholder")} required />
            </div>
            <div className="field">
              <label htmlFor="r-desc">{t("form.description")}</label>
              <textarea id="r-desc" placeholder={t("form.descriptionPlaceholder")} required />
            </div>
            <div className="field">
              <label htmlFor="r-photo">{t("form.photo")}</label>
              <input id="r-photo" type="file" accept="image/*" />
            </div>
            <div
              className="grid"
              style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 22 }}
            >
              <div className="field">
                <label htmlFor="r-name">{t("form.name")}</label>
                <input id="r-name" type="text" />
              </div>
              <div className="field">
                <label htmlFor="r-phone">{t("form.phone")}</label>
                <input id="r-phone" type="tel" />
              </div>
            </div>
            <button className="btn" type="submit">
              {t("form.send")}
            </button>
          </SiteForm>

          <aside className="side" data-reveal>
            <span className="label ph">{t("recent.label")}</span>
            <div className="rows" style={{ marginTop: 18 }}>
              {RECENT.map((r) => (
                <div
                  key={r.key}
                  className="row"
                  style={{ gap: 16, justifyContent: "space-between" }}
                >
                  <span>{t(`recent.${r.key}`)}</span>
                  <span className={`tag ${r.tone}`}>{t(`recent.${r.status}`)}</span>
                </div>
              ))}
            </div>
            <p className="lead" style={{ marginTop: 22, fontSize: 15 }}>
              {/* The number comes from the saved contact details (live). */}
              <Suspense fallback={<EmergencyLine />}>
                <SavedEmergencyLine locale={locale} />
              </Suspense>
            </p>
          </aside>
        </div>
      </section>
    </>
  );
}

// "For emergencies, call <number> instead." with the municipality's phone, or
// the design's placeholder while none is saved.
function EmergencyLine({ phone }: { phone?: string | null }) {
  const t = useTranslations("Report");
  return t.rich("emergency", {
    phone: phone ?? t("emergencyPlaceholder"),
    ph: (chunks) => (
      <span className="ph" dir="ltr">
        {chunks}
      </span>
    ),
  });
}

async function SavedEmergencyLine({ locale }: { locale: string }) {
  const s = await getSettings(locale);
  return <EmergencyLine phone={s?.phone} />;
}
