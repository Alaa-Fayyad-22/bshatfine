import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Preparing } from "@/components/Preparing";
import { Filters } from "@/components/site/Filters";
import { Hero } from "@/components/site/Hero";
import { photoSrc } from "@/components/site/Photo";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { coverUrl, getCouncil, type CouncilMemberDto } from "@/lib/api";
import { pageMetadata } from "@/lib/site-meta";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/municipality">): Promise<Metadata> {
  return pageMetadata((await params).locale, "municipality");
}

// PLACEHOLDER: the sample projects and documents of the approved design.
const PROJECTS = [
  { key: "road", status: "done" },
  { key: "lighting", status: "on" },
  { key: "water", status: "on" },
  { key: "garden", status: "plan" },
  { key: "waste", status: "done" },
] as const;

const DOCS = ["decision", "budget", "minutes"] as const;

export default async function Page({ params }: PageProps<"/[locale]/municipality">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Municipality");
  const tm = await getTranslations("Mayor");
  const tn = await getTranslations("Nav");

  return (
    <>
      <Hero
        image={photoSrc("council")}
        alt={t("hero.alt")}
        crumbs={[{ label: tn("municipality") }]}
        kicker={t("hero.kicker")}
        title={t("hero.title")}
      />

      <section className="section">
        <div className="wrap split" style={{ alignItems: "center" }}>
          <div className="main" style={{ display: "flex", flexDirection: "column", gap: 24 }} data-reveal>
            <span className="label ph">{tm("label")}</span>
            <p className="serif" style={{ margin: 0, fontStyle: "italic", fontSize: 40, lineHeight: 1.3 }}>
              {t("mayorQuote")}
            </p>
            <div>
              <div style={{ fontWeight: 500 }}>{tm("name")}</div>
              <div className="label" style={{ color: "var(--muted)" }}>
                {tm("role")}
              </div>
            </div>
          </div>
          <div
            className="side panel"
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
            data-reveal
          >
            <span className="label ph">{t("meetings.label")}</span>
            <p className="lead">
              {t.rich("meetings.text", {
                ph: (chunks) => <span className="ph">{chunks}</span>,
              })}
            </p>
            <Link className="tlink" href="/contact">
              {t("meetings.link")}
            </Link>
          </div>
        </div>
      </section>

      <section className="section band">
        <div className="wrap">
          <div className="head-row" data-reveal>
            <div>
              <span className="kicker">{t("council.kicker")}</span>
              <h2 className="title">{t("council.title")}</h2>
            </div>
            <p className="lead" style={{ maxWidth: 420 }}>
              {t("council.lead")}
            </p>
          </div>
          {/* The members are read live from the API. */}
          <Suspense
            fallback={
              <p role="status" className="lead">
                {t("council.loading")}
              </p>
            }
          >
            <Members locale={locale} />
          </Suspense>
        </div>
      </section>

      <section className="section" id="projects">
        <div className="wrap">
          <div className="head-row" data-reveal>
            <div>
              <span className="kicker">{t("projects.kicker")}</span>
              <h2 className="title">{t("projects.title")}</h2>
            </div>
            <Filters
              group="projects"
              label={t("projects.filtersLabel")}
              style={{ margin: 0 }}
              options={(["all", "done", "on", "plan"] as const).map((key) => ({
                key,
                label: t(`projects.filters.${key}`),
              }))}
            />
          </div>
          <div className="table-box" data-reveal>
            <table>
              <thead>
                <tr>
                  <th style={{ width: "44%" }}>{t("projects.cols.project")}</th>
                  <th>{t("projects.cols.area")}</th>
                  <th>{t("projects.cols.status")}</th>
                  <th>{t("projects.cols.year")}</th>
                </tr>
              </thead>
              <tbody data-filter-items="projects">
                {PROJECTS.map((p) => (
                  <tr key={p.key} data-cat={p.status}>
                    <td>
                      <span className="serif">{t(`projects.items.${p.key}.title`)}</span>
                      <br />
                      <span style={{ color: "var(--muted)" }}>{t(`projects.items.${p.key}.text`)}</span>
                    </td>
                    <td>{t(`projects.items.${p.key}.area`)}</td>
                    <td>
                      <span className={`tag st-${p.status}`}>{t(`projects.filters.${p.status}`)}</span>
                    </td>
                    <td className="ph">{t("projects.year")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="lead" style={{ marginTop: 18, fontSize: 14 }}>
            {t("projects.note")}
          </p>
        </div>
      </section>

      <section className="section band">
        <div className="wrap">
          <div className="head-row" data-reveal>
            <div>
              <span className="kicker">{t("docs.kicker")}</span>
              <h2 className="title">{t("docs.title")}</h2>
            </div>
          </div>
          <div className="rows">
            {DOCS.map((doc) => (
              <div key={doc} className="row" data-reveal>
                <span className="label ph" style={{ width: 120 }}>
                  {t("docs.date")}
                </span>
                <span className="serif" style={{ flex: 1, fontSize: 24, fontWeight: 600 }}>
                  {t(`docs.items.${doc}`)}
                </span>
                <span className="tlink">{t("docs.pdf")}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

// First letters of the first two words ("Ali Hassan" -> "AH", "علي حسن" -> "عح").
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("");
}

async function Members({ locale }: { locale: string }) {
  const t = await getTranslations("Municipality");

  let members: CouncilMemberDto[];
  try {
    members = await getCouncil(locale);
  } catch {
    return (
      <p role="status" className="lead">
        {t("council.error")}
      </p>
    );
  }
  if (members.length === 0) return <Preparing />;

  return (
    <div className="members">
      {members.map((m) => {
        const photo = coverUrl(m.photoUrl);
        return (
          <div key={m.id} className="member" data-reveal>
            {photo ? (
              // 4:5 portrait, cropped by the design's CSS whatever the upload's shape.
              <Image
                src={photo}
                alt={m.name}
                width={424}
                height={530}
                sizes="(max-width: 700px) 50vw, 260px"
              />
            ) : (
              <div className="nophoto" aria-hidden="true">
                <span className="initial">{initials(m.name)}</span>
              </div>
            )}
            <span className="n">{m.name}</span>
            <span className="r">{m.position}</span>
          </div>
        );
      })}
    </div>
  );
}
