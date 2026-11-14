import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { hasLocale, useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Hero } from "@/components/site/Hero";
import { Photo, photoSrc } from "@/components/site/Photo";
import { SiteForm } from "@/components/site/SiteForm";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import type { SiteSettingsDto } from "@/lib/api";
import { pageMetadata, telHref } from "@/lib/site-meta";
import { getSettings } from "@/lib/site-settings";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/contact">): Promise<Metadata> {
  return pageMetadata((await params).locale, "contact");
}

const SUBJECTS = ["general", "forms", "fees", "suggestion", "media"] as const;

// Used while the municipality has not saved its own map link.
const DEFAULT_MAP = "https://www.google.com/maps/search/Bchatfine+Lebanon";

export default async function Page({ params }: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Contact");
  const tn = await getTranslations("Nav");
  const tf = await getTranslations("Forms");

  return (
    <>
      <Hero
        image={photoSrc("aerial")}
        alt={t("hero.alt")}
        crumbs={[{ label: tn("contact") }]}
        kicker={t("hero.kicker")}
        title={t("hero.title")}
      />

      <section className="section">
        <div className="wrap split" style={{ alignItems: "flex-start" }}>
          {/* The details are read live from the saved contact details. */}
          <Suspense fallback={<Details settings={null} />}>
            <SavedDetails locale={locale} />
          </Suspense>

          {/* No back end yet: submitting only shows the "coming soon" message. */}
          <SiteForm className="main form panel" message={tf("comingSoon")}>
            <span className="kicker">{t("form.kicker")}</span>
            <h2 className="title" style={{ fontSize: 48 }}>
              {t("form.title")}
            </h2>
            <div
              className="grid"
              style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 22 }}
            >
              <div className="field">
                <label htmlFor="c-name">{t("form.name")}</label>
                <input id="c-name" type="text" required />
              </div>
              <div className="field">
                <label htmlFor="c-email">{t("form.contact")}</label>
                <input id="c-email" type="text" required />
              </div>
            </div>
            <div className="field">
              <label htmlFor="c-subject">{t("form.subject")}</label>
              <select id="c-subject">
                {SUBJECTS.map((s) => (
                  <option key={s}>{t(`form.subjects.${s}`)}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="c-msg">{t("form.message")}</label>
              <textarea id="c-msg" required />
            </div>
            <button className="btn" type="submit">
              {t("form.send")}
            </button>
          </SiteForm>
        </div>
      </section>

      <section className="statement" style={{ height: 420 }}>
        <Photo name="sunset" alt={t("statement.alt")} fill sizes="100vw" />
        <div className="veil" />
        <div className="in">
          <p style={{ fontSize: 44 }} data-reveal>
            {t("statement.quote")}
          </p>
          <Link className="tlink" href="/discover" style={{ color: "var(--paper)" }}>
            {t("statement.link")}
          </Link>
        </div>
      </section>
    </>
  );
}

async function SavedDetails({ locale }: { locale: string }) {
  return <Details settings={await getSettings(locale)} />;
}

// The details column. Every value comes from the saved contact details and a
// missing one is left out. The map link opens the saved map address, or a
// Google Maps search for the village while none is saved.
function Details({ settings: s }: { settings: SiteSettingsDto | null }) {
  const t = useTranslations("Contact");
  const phones = [s?.phone, s?.secondaryPhone].filter((p): p is string => !!p);
  const value = { margin: "6px 0 0", fontSize: 18 };

  return (
    <div className="side" style={{ display: "flex", flexDirection: "column", gap: 30 }}>
      <div>
        <span className="label ph">{t("hall")}</span>
        <p
          className="serif"
          style={{ fontSize: 28, lineHeight: 1.35, margin: "8px 0 0", whiteSpace: "pre-line" }}
        >
          {s?.address || t("country")}
        </p>
      </div>
      {phones.length > 0 && (
        <div>
          <span className="label ph">{t("phone")}</span>
          {phones.map((p) => (
            <p key={p} style={value}>
              <a href={telHref(p)} dir="ltr" style={{ textDecoration: "none", unicodeBidi: "isolate" }}>
                {p}
              </a>
            </p>
          ))}
        </div>
      )}
      {s?.email && (
        <div>
          <span className="label ph">{t("email")}</span>
          <p style={value}>
            <a
              href={`mailto:${s.email}`}
              dir="ltr"
              style={{ textDecoration: "none", overflowWrap: "anywhere" }}
            >
              {s.email}
            </a>
          </p>
        </div>
      )}
      {s?.openingHours && (
        <div>
          <span className="label ph">{t("hours")}</span>
          <p style={{ ...value, whiteSpace: "pre-line" }}>{s.openingHours}</p>
        </div>
      )}
      <a className="tlink" href={s?.mapUrl || DEFAULT_MAP} target="_blank" rel="noopener noreferrer">
        {t("map")}
        <span className="sr-only"> {t("newTab")}</span>
      </a>
    </div>
  );
}
