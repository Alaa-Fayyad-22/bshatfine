import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EventRows } from "@/components/site/EventRows";
import { Hero } from "@/components/site/Hero";
import { photoSrc } from "@/components/site/Photo";
import { SiteForm } from "@/components/site/SiteForm";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/site-meta";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/events">): Promise<Metadata> {
  return pageMetadata((await params).locale, "events");
}

export default async function Page({ params }: PageProps<"/[locale]/events">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Events");
  const tn = await getTranslations("Nav");
  const tf = await getTranslations("Forms");

  return (
    <>
      <Hero
        image={photoSrc("festival")}
        alt={t("hero.alt")}
        crumbs={[{ label: tn("events") }]}
        kicker={t("hero.kicker")}
        title={t("hero.title")}
      />

      <section className="section">
        <div className="wrap split">
          <div className="main">
            <EventRows variant="events" />
            <p className="lead" style={{ marginTop: 18, fontSize: 14 }}>
              {t("note")}
            </p>
          </div>
          {/* No back end yet: submitting only shows the "coming soon" message. */}
          <SiteForm
            className="side form panel"
            style={{ alignSelf: "flex-start" }}
            message={tf("comingSoon")}
          >
            <span className="kicker" style={{ fontSize: 26 }}>
              {t("host.kicker")}
            </span>
            <h2 className="title" style={{ fontSize: 40 }}>
              {t("host.title")}
            </h2>
            <p className="lead" style={{ fontSize: 15 }}>
              {t("host.lead")}
            </p>
            <div className="field">
              <label htmlFor="e-name">{t("host.name")}</label>
              <input id="e-name" type="text" required />
            </div>
            <div className="field">
              <label htmlFor="e-date">{t("host.date")}</label>
              <input id="e-date" type="date" required />
            </div>
            <div className="field">
              <label htmlFor="e-place">{t("host.place")}</label>
              <input id="e-place" type="text" />
            </div>
            <div className="field">
              <label htmlFor="e-contact">{t("host.contact")}</label>
              <input id="e-contact" type="text" required />
            </div>
            <button className="btn" type="submit">
              {t("host.send")}
            </button>
          </SiteForm>
        </div>
      </section>
    </>
  );
}
