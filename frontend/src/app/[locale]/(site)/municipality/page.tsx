import type { Metadata } from "next";
import { SiteImage } from "@/components/SiteImage";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Preparing } from "@/components/Preparing";
import { Filters } from "@/components/site/Filters";
import { Hero } from "@/components/site/Hero";
import { photoSrc } from "@/components/site/Photo";
import { directionOf, LanguageNote } from "@/components/LanguageNote";
import {
  isProjectStatus,
  knownCategory,
  STATUS_CLASS,
  type ProjectStatus,
} from "@/config/entries";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import {
  coverUrl,
  getCouncil,
  getEntries,
  type CouncilMemberDto,
  type EntrySummaryDto,
} from "@/lib/api";
import { formatYear } from "@/lib/numbers";
import { pageMetadata } from "@/lib/site-meta";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/municipality">): Promise<Metadata> {
  return pageMetadata((await params).locale, "municipality");
}

// The status filters in the order of the approved design.
const STATUS_FILTER_ORDER = ["completed", "ongoing", "planned"] as const satisfies readonly ProjectStatus[];

// PLACEHOLDER: the sample documents of the approved design.
const DOCS = ["decision", "budget", "minutes"] as const;

export default async function Page({ params }: PageProps<"/[locale]/municipality">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Municipality");
  const tm = await getTranslations("Mayor");
  const tn = await getTranslations("Nav");
  const te = await getTranslations("Entries");

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
          {/* The published projects, read live. The filter buttons come with
              the table (there is nothing to filter while it is empty). */}
          <Suspense
            fallback={
              <>
                <ProjectsHead />
                <p role="status" className="lead">
                  {te("loading")}
                </p>
              </>
            }
          >
            <Projects locale={locale} />
          </Suspense>
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

async function ProjectsHead({ entries }: { entries?: EntrySummaryDto[] }) {
  const t = await getTranslations("Municipality");
  return (
    <div className="head-row" data-reveal>
      <div>
        <span className="kicker">{t("projects.kicker")}</span>
        <h2 className="title">{t("projects.title")}</h2>
      </div>
      {entries && entries.length > 0 && (
        <Filters
          group="projects"
          label={t("projects.filtersLabel")}
          style={{ margin: 0 }}
          options={(["all", ...STATUS_FILTER_ORDER] as const).map((key) => ({
            key,
            label: t(`projects.filters.${key}`),
          }))}
        />
      )}
    </div>
  );
}

// The published projects in their order: title and summary (leading to the
// project's own page), area, status tag and year; filtered by status.
async function Projects({ locale }: { locale: string }) {
  const t = await getTranslations("Municipality");
  const te = await getTranslations("Entries");

  let entries: EntrySummaryDto[];
  try {
    entries = await getEntries("project", locale);
  } catch {
    return (
      <>
        <ProjectsHead />
        <p role="status" className="lead">
          {te("error")}
        </p>
      </>
    );
  }
  if (entries.length === 0) {
    return (
      <>
        <ProjectsHead />
        <Preparing />
      </>
    );
  }

  return (
    <>
      <ProjectsHead entries={entries} />
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
            {entries.map((p) => {
              const area = knownCategory("project", p.category);
              const status = isProjectStatus(p.status) ? p.status : null;
              return (
                <tr key={p.id} data-cat={status ?? undefined}>
                  <td>
                    <Link
                      className="serif"
                      href={`/entries/${p.id}`}
                      lang={p.language}
                      dir={directionOf(p.language)}
                      style={{ textDecoration: "none" }}
                    >
                      {p.title}
                    </Link>
                    <br />
                    <span lang={p.language} dir={directionOf(p.language)} style={{ color: "var(--muted)" }}>
                      {p.summary}
                    </span>
                    <LanguageNote language={p.language} locale={locale} of="Entries" />
                  </td>
                  <td>{area && te(`categories.project.${area}`)}</td>
                  <td>
                    {status && (
                      <span className={`tag ${STATUS_CLASS[status]}`}>{te(`statuses.${status}`)}</span>
                    )}
                  </td>
                  <td>{p.year !== null && formatYear(p.year, locale)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
              <SiteImage
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
