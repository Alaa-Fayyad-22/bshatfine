import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { directionOf, LanguageNote } from "@/components/LanguageNote";
import { Markdown } from "@/components/Markdown";
import { EVENT_DEFAULT_COVER } from "@/components/site/EventCard";
import { Hero } from "@/components/site/Hero";
import { photoSrc } from "@/components/site/Photo";
import { CATEGORY_CLASS, isEventCategory, isSafeMapUrl } from "@/config/events";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { coverUrl, getEvent, type EventDto } from "@/lib/api";
import { formatEventWhen } from "@/lib/event-time";
import { siteUrl } from "@/lib/site-url";

// One event on its own page. Built like the entry page: Cache Components needs
// one param to prerender the route shell, and this placeholder only produces it.
const SHELL_ID = "_";

export function generateStaticParams() {
  return [{ id: SHELL_ID }];
}

// Blocks on purpose: an unknown or unpublished id must answer with a real 404
// (the proxy checks it live first, see src/proxy.ts).
export const instant = false;

// One request per render, shared by generateMetadata and the page.
// undefined = the API could not be reached.
const loadEvent = cache(async (locale: string, id: string): Promise<EventDto | null | undefined> => {
  if (id === SHELL_ID) return null;
  try {
    return await getEvent(locale, id);
  } catch {
    return undefined;
  }
});

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/events/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Meta" });
  const event = await loadEvent(locale, id);
  if (!event) return { title: t("pages.events") };
  const title = t("pages.event", { title: event.title });
  const path = coverUrl(event.coverImageUrl);
  const base = siteUrl();
  const cover = path && base ? new URL(path, base).toString() : null;
  return {
    title,
    description: event.summary,
    ...(cover && {
      openGraph: { title, images: [{ url: cover, alt: event.title }] },
      twitter: { card: "summary_large_image", title, images: [cover] },
    }),
  };
}

// The hero title shrinks in two steps for long titles, so it never overflows.
function titleSize(title: string): string | undefined {
  const length = Array.from(title).length;
  if (length > 80) return "xlong";
  if (length > 28) return "long";
  return undefined;
}

const row = { display: "flex", flexWrap: "wrap", gap: "4px 14px", alignItems: "baseline" } as const;
const term = { color: "var(--muted)", minWidth: 110 } as const;

export default async function Page({ params }: PageProps<"/[locale]/events/[id]">) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Events");
  const tn = await getTranslations("Nav");
  const event = await loadEvent(locale, id);
  if (event === null) notFound();

  const column = { maxWidth: 760, display: "flex", flexDirection: "column", gap: 22 } as const;
  const crumbs = [{ label: tn("events"), href: "/events" }];

  // API down: a calm message under a neutral hero, never a broken page.
  if (event === undefined) {
    return (
      <>
        <Hero image={photoSrc("festival")} alt={t("hero.alt")} crumbs={crumbs} title={t("errorTitle")} />
        <section className="section">
          <div className="wrap">
            <div style={column}>
              <p role="status" className="lead">
                {t("eventError")}
              </p>
            </div>
          </div>
        </section>
      </>
    );
  }

  const cover = coverUrl(event.coverImageUrl);
  const dir = directionOf(event.language);
  const category = isEventCategory(event.category) ? event.category : null;
  const mapUrl = isSafeMapUrl(event.mapUrl) ? event.mapUrl : null;

  return (
    <>
      <Hero
        image={cover ?? EVENT_DEFAULT_COVER}
        alt={cover ? event.title : t("defaultCoverAlt")}
        crumbs={crumbs}
        kicker={category ? t(`categories.${category}`) : undefined}
        title={event.title}
        titleClassName={titleSize(event.title)}
        titleLang={event.language}
        titleDir={dir}
      />

      <section className="section">
        <div className="wrap">
          <article style={column}>
            {event.isPast && (
              <p
                role="note"
                className="label"
                style={{
                  margin: 0,
                  padding: "14px 18px",
                  borderInlineStart: "3px solid var(--clay)",
                  background: "var(--stone)",
                  color: "var(--ink)",
                }}
              >
                {t("ended")}
              </p>
            )}
            <LanguageNote language={event.language} locale={locale} of="Events" />

            <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {category && (
                <div style={row}>
                  <dt className="label" style={term}>
                    {t("meta.category")}
                  </dt>
                  <dd style={{ margin: 0 }}>
                    <span className={`tag ${CATEGORY_CLASS[category]}`}>{t(`categories.${category}`)}</span>
                  </dd>
                </div>
              )}
              <div style={row}>
                <dt className="label" style={term}>
                  {t("meta.when")}
                </dt>
                <dd style={{ margin: 0, fontSize: 18 }}>
                  <time dateTime={event.startsAt}>{formatEventWhen(locale, event)}</time>
                </dd>
              </div>
              {event.location.trim() !== "" && (
                <div style={row}>
                  <dt className="label" style={term}>
                    {t("meta.location")}
                  </dt>
                  <dd lang={event.language} dir={dir} style={{ margin: 0, fontSize: 18, overflowWrap: "anywhere" }}>
                    {event.location}
                  </dd>
                </div>
              )}
              {event.organizer.trim() !== "" && (
                <div style={row}>
                  <dt className="label" style={term}>
                    {t("meta.organizer")}
                  </dt>
                  <dd lang={event.language} dir={dir} style={{ margin: 0, fontSize: 18, overflowWrap: "anywhere" }}>
                    {event.organizer}
                  </dd>
                </div>
              )}
            </dl>

            {mapUrl && (
              <a className="tlink" href={mapUrl} target="_blank" rel="noopener noreferrer" style={{ alignSelf: "flex-start" }}>
                {t("map")}
                <span className="sr-only"> {t("newTab")}</span>
              </a>
            )}

            <div lang={event.language} dir={dir} style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              <p className="serif" style={{ margin: 0, fontSize: 28, lineHeight: 1.4, overflowWrap: "anywhere" }}>
                {event.summary}
              </p>
              {event.body.trim() !== "" && <Markdown site>{event.body}</Markdown>}
            </div>

            <Link className="tlink" href="/events" style={{ alignSelf: "flex-start" }}>
              {t("back")}
            </Link>
          </article>
        </div>
      </section>
    </>
  );
}
