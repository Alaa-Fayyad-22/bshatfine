import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EventCard } from "@/components/site/EventCard";
import { Hero } from "@/components/site/Hero";
import { photoSrc } from "@/components/site/Photo";
import { SiteForm } from "@/components/site/SiteForm";
import { PAST_PAGE_SIZE } from "@/config/events";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getPastEvents, getUpcomingEvents, type EventPage, type EventSummaryDto } from "@/lib/api";
import { formatNumber } from "@/lib/numbers";
import { pageMetadata } from "@/lib/site-meta";

// The API returns at most 50 upcoming events at once.
const UPCOMING_LIMIT = 50;

const GRID = { gridTemplateColumns: "repeat(auto-fit,minmax(min(280px,100%),1fr))" } as const;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/events">): Promise<Metadata> {
  const { locale } = await params;
  const meta = await pageMetadata(locale, "events");
  if (!hasLocale(routing.locales, locale)) return meta;
  const t = await getTranslations({ locale, namespace: "Events" });
  return { ...meta, description: t("description") };
}

export default async function Page({ params, searchParams }: PageProps<"/[locale]/events">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Events");
  const tn = await getTranslations("Nav");
  const tf = await getTranslations("Forms");

  const loading = (
    <p role="status" className="lead">
      {t("loading")}
    </p>
  );

  // The frame is static; both lists are read live, so they stream in behind
  // <Suspense> (the past events also depend on ?page=N).
  return (
    <>
      <Hero
        image={photoSrc("festival")}
        alt={t("hero.alt")}
        crumbs={[{ label: tn("events") }]}
        kicker={t("hero.kicker")}
        title={t("hero.title")}
      />

      <section className="section" aria-labelledby="upcoming-title">
        <div className="wrap split">
          <div className="main">
            <div style={{ marginBottom: 36 }}>
              <span className="kicker">{t("upcoming.kicker")}</span>
              <h2 id="upcoming-title" className="title">
                {t("upcoming.title")}
              </h2>
            </div>
            <Suspense fallback={loading}>
              <Upcoming locale={locale} />
            </Suspense>
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

      <section id="past" className="section band" aria-labelledby="past-title">
        <div className="wrap">
          <div style={{ marginBottom: 36 }}>
            <span className="kicker">{t("past.kicker")}</span>
            <h2 id="past-title" className="title">
              {t("past.title")}
            </h2>
          </div>
          <Suspense fallback={loading}>
            <Past locale={locale} searchParams={searchParams} />
          </Suspense>
        </div>
      </section>
    </>
  );
}

async function Upcoming({ locale }: { locale: string }) {
  const t = await getTranslations("Events");
  let events: EventSummaryDto[];
  try {
    events = await getUpcomingEvents(locale, UPCOMING_LIMIT);
  } catch {
    return (
      <p role="status" className="lead">
        {t("error")}
      </p>
    );
  }
  if (events.length === 0) return <p className="lead">{t("upcoming.empty")}</p>;
  return (
    <div className="grid" style={GRID}>
      {events.map((e) => (
        <EventCard key={e.id} event={e} />
      ))}
    </div>
  );
}

function parsePage(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

const pastHref = (page: number) =>
  page === 1
    ? { pathname: "/events" as const, hash: "past" }
    : { pathname: "/events" as const, query: { page }, hash: "past" };

async function Past({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: PageProps<"/[locale]/events">["searchParams"];
}) {
  const page = parsePage((await searchParams).page);
  const t = await getTranslations("Events");
  let result: EventPage;
  try {
    result = await getPastEvents(locale, page, PAST_PAGE_SIZE);
  } catch {
    return (
      <p role="status" className="lead">
        {t("error")}
      </p>
    );
  }

  const { items, totalPages } = result;

  // Asked for a page past the end: say so and point back to page 1.
  if (page > Math.max(totalPages, 1)) {
    return (
      <div role="status" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <p className="lead">{t("past.pageOutOfRange")}</p>
        <Link className="tlink" href={pastHref(1)} style={{ alignSelf: "flex-start" }}>
          {t("past.goToFirst")}
        </Link>
      </div>
    );
  }

  if (items.length === 0) return <p className="lead">{t("past.empty")}</p>;

  return (
    <>
      <div className="grid" style={GRID}>
        {items.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </div>

      {totalPages > 1 && (
        <nav className="filters" style={{ margin: "36px 0 0" }} aria-label={t("past.pagination")}>
          {page > 1 && (
            <Link href={pastHref(page - 1)} rel="prev">
              {t("past.previous")}
            </Link>
          )}
          <span className="now" aria-current="page">
            {t("past.page", { page: formatNumber(page, locale), total: formatNumber(totalPages, locale) })}
          </span>
          {page < totalPages && (
            <Link href={pastHref(page + 1)} rel="next">
              {t("past.next")}
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
