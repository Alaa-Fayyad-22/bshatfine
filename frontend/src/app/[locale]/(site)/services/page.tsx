import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { directionOf, LanguageNote } from "@/components/LanguageNote";
import { Preparing } from "@/components/Preparing";
import { Filters } from "@/components/site/Filters";
import { Hero } from "@/components/site/Hero";
import { photoSrc } from "@/components/site/Photo";
import { ToastButton } from "@/components/site/Toast";
import { ENTRY_RULES, knownCategory } from "@/config/entries";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getEntries, type EntrySummaryDto } from "@/lib/api";
import { pageMetadata } from "@/lib/site-meta";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/services">): Promise<Metadata> {
  return pageMetadata((await params).locale, "services");
}

const STEPS = ["download", "prepare", "submit", "follow"] as const;

export default async function Page({ params }: PageProps<"/[locale]/services">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Services");
  const tn = await getTranslations("Nav");
  const te = await getTranslations("Entries");

  return (
    <>
      <Hero
        image={photoSrc("street")}
        alt={t("hero.alt")}
        crumbs={[{ label: tn("services") }]}
        kicker={t("hero.kicker")}
        title={t("hero.title")}
        action={
          <Link className="tlink" href="/report">
            {t("hero.report")}
          </Link>
        }
      />

      <section className="section">
        <div className="wrap">
          <div className="head-row" data-reveal>
            <div>
              <span className="kicker">{t("how.kicker")}</span>
              <h2 className="title">{t("how.title")}</h2>
            </div>
          </div>
          <div className="steps">
            {STEPS.map((step) => (
              <div key={step} className="step" data-reveal>
                <span className="num">{t(`how.steps.${step}.num`)}</span>
                <span className="t">{t(`how.steps.${step}.title`)}</span>
                <p className="lead">{t(`how.steps.${step}.text`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section band" id="forms">
        <div className="wrap">
          <div className="head-row" data-reveal>
            <div>
              <span className="kicker">{t("forms.kicker")}</span>
              <h2 className="title">{t("forms.title")}</h2>
            </div>
          </div>
          {/* The published services, read live. */}
          <Suspense
            fallback={
              <p role="status" className="lead">
                {te("loading")}
              </p>
            }
          >
            <Forms locale={locale} />
          </Suspense>
        </div>
      </section>

      <section className="section">
        <div className="wrap split" style={{ alignItems: "center" }}>
          <div className="main" data-reveal>
            <span className="kicker">{t("fix.kicker")}</span>
            <h2 className="title">{t("fix.title")}</h2>
            <p className="lead" style={{ marginTop: 18, maxWidth: 560 }}>
              {t("fix.lead")}
            </p>
          </div>
          <div className="side">
            <Link
              className="btn"
              href="/report"
              style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}
            >
              {t("fix.button")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

// The published services in their order: title and summary (leading to the
// service's own page), type, and the Download placeholder (no files yet);
// filtered by type.
async function Forms({ locale }: { locale: string }) {
  const t = await getTranslations("Services");
  const te = await getTranslations("Entries");
  const tf = await getTranslations("Forms");

  let entries: EntrySummaryDto[];
  try {
    entries = await getEntries("service", locale);
  } catch {
    return (
      <p role="status" className="lead">
        {te("error")}
      </p>
    );
  }
  if (entries.length === 0) return <Preparing />;

  return (
    <>
      <Filters
        group="forms"
        label={t("forms.filtersLabel")}
        options={(["all", ...ENTRY_RULES.service.categories] as const).map((key) => ({
          key,
          label: t(`forms.filters.${key}`),
        }))}
      />
      <div className="table-box" data-reveal>
        <table>
          <thead>
            <tr>
              <th style={{ width: "36%" }}>{t("forms.cols.form")}</th>
              <th>{t("forms.cols.type")}</th>
              {/* relative: keeps the hidden label inside the scrolling table box */}
              <th style={{ position: "relative" }}>
                <span className="sr-only">{t("forms.cols.download")}</span>
              </th>
            </tr>
          </thead>
          <tbody data-filter-items="forms">
            {entries.map((form) => {
              const type = knownCategory("service", form.category);
              return (
                <tr key={form.id} data-cat={type ?? undefined}>
                  <td>
                    <Link
                      className="serif"
                      href={`/entries/${form.id}`}
                      lang={form.language}
                      dir={directionOf(form.language)}
                      style={{ textDecoration: "none" }}
                    >
                      {form.title}
                    </Link>
                    <br />
                    <span lang={form.language} dir={directionOf(form.language)} style={{ color: "var(--muted)" }}>
                      {form.summary}
                    </span>
                    <LanguageNote language={form.language} locale={locale} of="Entries" />
                  </td>
                  <td>{type && te(`categories.service.${type}`)}</td>
                  <td>
                    <ToastButton className="tlink" message={tf("downloadSoon")}>
                      {t("forms.download")}
                    </ToastButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
