import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { directionOf, LanguageNote } from "@/components/LanguageNote";
import { Preparing } from "@/components/Preparing";
import { Filters } from "@/components/site/Filters";
import { Hero } from "@/components/site/Hero";
import { CARD_SIZES, Photo, photoSrc } from "@/components/site/Photo";
import { ENTRY_RULES, knownCategory, PLACE_PHOTO } from "@/config/entries";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { coverUrl, getEntries, type EntrySummaryDto } from "@/lib/api";
import { pageMetadata } from "@/lib/site-meta";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/discover">): Promise<Metadata> {
  return pageMetadata((await params).locale, "discover");
}

const GLANCE = ["altitude", "beirut", "district", "residents"] as const;
const STEPS = ["here", "eat", "stay"] as const;

export default async function Page({ params }: PageProps<"/[locale]/discover">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Discover");
  const tn = await getTranslations("Nav");

  return (
    <>
      <Hero
        image={photoSrc("sunset")}
        alt={t("hero.alt")}
        crumbs={[{ label: tn("discover") }]}
        kicker={t("hero.kicker")}
        title={t("hero.title")}
      />

      <section className="section" id="story">
        <div className="wrap split" style={{ alignItems: "flex-start" }}>
          <div className="main" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <span className="kicker">{t("story.kicker")}</span>
            {/* The published history entries, read live, in their order. */}
            <Suspense fallback={<Loading />}>
              <Story locale={locale} />
            </Suspense>
          </div>
          <div
            className="side panel"
            style={{ display: "flex", flexDirection: "column", gap: 18 }}
            data-reveal
          >
            <span className="label ph">{t("glance.label")}</span>
            {GLANCE.map((key, i) => (
              <div
                key={key}
                className="row"
                style={{
                  padding: "14px 0",
                  gap: 16,
                  justifyContent: "space-between",
                  ...(i === GLANCE.length - 1 && { borderBottom: "1px solid #CFC7B9" }),
                }}
              >
                <span>{t(`glance.${key}`)}</span>
                <span className="ph">{t(`glance.${key}Value`)}</span>
              </div>
            ))}
            <Link className="tlink" href="/contact">
              {t("glance.link")}
            </Link>
          </div>
        </div>
      </section>

      <section className="section band" id="places">
        <div className="wrap">
          {/* The published places, read live. The filter buttons come with the
              list (there is nothing to filter while it is empty). */}
          <Suspense
            fallback={
              <>
                <PlacesHead />
                <Loading />
              </>
            }
          >
            <Places locale={locale} />
          </Suspense>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="head-row" data-reveal>
            <div>
              <span className="kicker">{t("before.kicker")}</span>
              <h2 className="title">{t("before.title")}</h2>
            </div>
          </div>
          <div className="steps">
            {STEPS.map((step) => (
              <div key={step} className="step" data-reveal>
                <span className="num">{t(`before.steps.${step}.num`)}</span>
                <span className="t">{t(`before.steps.${step}.title`)}</span>
                <p className="lead">{t(`before.steps.${step}.text`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

async function Loading() {
  const t = await getTranslations("Entries");
  return (
    <p role="status" className="lead">
      {t("loading")}
    </p>
  );
}

async function LoadError() {
  const t = await getTranslations("Entries");
  return (
    <p role="status" className="lead">
      {t("error")}
    </p>
  );
}

// null when the API cannot be reached (the section then says so).
async function load(kind: "history" | "place", locale: string) {
  try {
    return await getEntries(kind, locale);
  } catch {
    return null;
  }
}

// The village story: the published history entries in their order (year,
// title, summary, cover if any), each leading to its own page.
async function Story({ locale }: { locale: string }) {
  const entries = await load("history", locale);
  if (entries === null) return <LoadError />;
  if (entries.length === 0) return <Preparing />;

  return (
    <div className="rows">
      {entries.map((e) => {
        const cover = coverUrl(e.coverImageUrl);
        return (
          <Link key={e.id} className="row" href={`/entries/${e.id}`} data-reveal>
            {cover && (
              // Decorative: the title right next to it says what it shows.
              <Image
                src={cover}
                alt=""
                width={240}
                height={180}
                sizes="120px"
                style={{ width: 120, height: 90, objectFit: "cover", flexShrink: 0 }}
              />
            )}
            <div className="ev" style={{ minWidth: 0, overflowWrap: "break-word" }}>
              {e.year !== null && <span className="label">{e.year}</span>}
              <span className="t" lang={e.language} dir={directionOf(e.language)}>
                {e.title}
              </span>
              <span className="m" lang={e.language} dir={directionOf(e.language)}>
                {e.summary}
              </span>
              <LanguageNote language={e.language} locale={locale} of="Entries" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

async function PlacesHead({ entries }: { entries?: EntrySummaryDto[] }) {
  const t = await getTranslations("Discover");
  return (
    <div className="head-row" data-reveal>
      <div>
        <span className="kicker">{t("places.kicker")}</span>
        <h2 className="title">{t("places.title")}</h2>
      </div>
      {entries && entries.length > 0 && (
        <Filters
          group="places"
          label={t("places.filtersLabel")}
          style={{ margin: 0 }}
          options={(["all", ...ENTRY_RULES.place.categories] as const).map((key) => ({
            key,
            label: t(`places.filters.${key}`),
          }))}
        />
      )}
    </div>
  );
}

// Places to see: the published places in their order, filtered by category.
async function Places({ locale }: { locale: string }) {
  const t = await getTranslations("Entries");
  const entries = await load("place", locale);
  if (entries === null) {
    return (
      <>
        <PlacesHead />
        <LoadError />
      </>
    );
  }
  if (entries.length === 0) {
    return (
      <>
        <PlacesHead />
        <Preparing />
      </>
    );
  }

  return (
    <>
      <PlacesHead entries={entries} />
      <div className="grid g3" data-filter-items="places">
        {entries.map((e) => {
          const category = knownCategory("place", e.category);
          const cover = coverUrl(e.coverImageUrl);
          return (
            <Link
              key={e.id}
              className="pcard"
              href={`/entries/${e.id}`}
              data-cat={category ?? undefined}
              data-reveal
            >
              {cover ? (
                <Image
                  src={cover}
                  alt={e.title}
                  width={840}
                  height={1260}
                  sizes={CARD_SIZES}
                  style={{ height: 420 }}
                />
              ) : (
                // No cover: one of the village photos, decorative.
                <Photo
                  name={category ? PLACE_PHOTO[category] : ENTRY_RULES.place.photo}
                  alt=""
                  sizes={CARD_SIZES}
                  style={{ height: 420 }}
                />
              )}
              {category && <span className="label">{t(`categories.place.${category}`)}</span>}
              <span className="t" lang={e.language} dir={directionOf(e.language)}>
                {e.title}
              </span>
              <span className="d" lang={e.language} dir={directionOf(e.language)}>
                {e.summary}
              </span>
              <LanguageNote language={e.language} locale={locale} of="Entries" />
            </Link>
          );
        })}
      </div>
    </>
  );
}
