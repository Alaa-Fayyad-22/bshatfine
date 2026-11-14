import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Filters } from "@/components/site/Filters";
import { Hero } from "@/components/site/Hero";
import { photoSrc } from "@/components/site/Photo";
import { ToastButton } from "@/components/site/Toast";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/site-meta";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/services">): Promise<Metadata> {
  return pageMetadata((await params).locale, "services");
}

const STEPS = ["download", "prepare", "submit", "follow"] as const;

// PLACEHOLDER: the sample forms of the approved design (no PDFs exist yet).
const FORMS = [
  { key: "residence", cat: "cert" },
  { key: "clearance", cat: "cert" },
  { key: "building", cat: "permit" },
  { key: "occupation", cat: "permit" },
  { key: "rent", cat: "fees" },
  { key: "instalment", cat: "fees" },
  { key: "objection", cat: "fees" },
] as const;

export default async function Page({ params }: PageProps<"/[locale]/services">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Services");
  const tn = await getTranslations("Nav");
  const tf = await getTranslations("Forms");
  // Each form shows its name in the other language underneath.
  const otherLang = locale === "ar" ? "en" : "ar";

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

      <section className="section band">
        <div className="wrap">
          <div className="head-row" data-reveal>
            <div>
              <span className="kicker">{t("forms.kicker")}</span>
              <h2 className="title">{t("forms.title")}</h2>
            </div>
          </div>
          <Filters
            group="forms"
            label={t("forms.filtersLabel")}
            options={(["all", "cert", "permit", "fees"] as const).map((key) => ({
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
                  <th>{t("forms.cols.papers")}</th>
                  <th>{t("forms.cols.fee")}</th>
                  {/* relative: keeps the hidden label inside the scrolling table box */}
                  <th style={{ position: "relative" }}>
                    <span className="sr-only">{t("forms.cols.download")}</span>
                  </th>
                </tr>
              </thead>
              <tbody data-filter-items="forms">
                {FORMS.map((form) => (
                  <tr key={form.key} data-cat={form.cat}>
                    <td>
                      <span className="serif">{t(`forms.items.${form.key}.title`)}</span>
                      <br />
                      <span lang={otherLang} style={{ color: "var(--muted)" }}>
                        {t(`forms.items.${form.key}.other`)}
                      </span>
                    </td>
                    <td>{t(`forms.types.${form.cat}`)}</td>
                    <td>{t(`forms.items.${form.key}.papers`)}</td>
                    <td className="ph">{t("forms.fee")}</td>
                    <td>
                      <ToastButton className="tlink" message={tf("downloadSoon")}>
                        {t("forms.download")}
                      </ToastButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="lead" style={{ marginTop: 18, fontSize: 14 }}>
            {t("forms.note")}
          </p>
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
