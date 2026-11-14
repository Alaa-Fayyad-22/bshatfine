import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { directionOf, LanguageNote } from "@/components/LanguageNote";
import { Markdown } from "@/components/Markdown";
import { Filters } from "@/components/site/Filters";
import { Hero } from "@/components/site/Hero";
import { CARD_SIZES, Photo, photoSrc, type PhotoName } from "@/components/site/Photo";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getPage, type PageDto } from "@/lib/api";
import { pageMetadata } from "@/lib/site-meta";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/discover">): Promise<Metadata> {
  return pageMetadata((await params).locale, "discover");
}

type PlaceKey = "gate" | "sunset" | "street" | "aerial" | "festival" | "golden";
type PlaceCategory = "heritage" | "nature" | "life";

// PLACEHOLDER: the places of the approved design (the photo has the same name).
const PLACES: ReadonlyArray<{ key: PlaceKey & PhotoName; cat: PlaceCategory }> = [
  { key: "gate", cat: "heritage" },
  { key: "sunset", cat: "nature" },
  { key: "street", cat: "nature" },
  { key: "aerial", cat: "heritage" },
  { key: "festival", cat: "life" },
  { key: "golden", cat: "nature" },
];

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

      <section className="section">
        <div className="wrap split" style={{ alignItems: "flex-start" }}>
          <div className="main" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <span className="kicker">{t("story.kicker")}</span>
            {/* The published "history" page, read live. */}
            <Suspense fallback={null}>
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

      <section className="section band">
        <div className="wrap">
          <div className="head-row" data-reveal>
            <div>
              <span className="kicker">{t("places.kicker")}</span>
              <h2 className="title">{t("places.title")}</h2>
            </div>
            <Filters
              group="places"
              label={t("places.filtersLabel")}
              style={{ margin: 0 }}
              options={(["all", "heritage", "nature", "life"] as const).map((key) => ({
                key,
                label: t(`places.filters.${key}`),
              }))}
            />
          </div>
          <div className="grid g3" data-filter-items="places">
            {PLACES.map((place) => (
              <div key={place.key} className="pcard" data-cat={place.cat} data-reveal>
                <Photo
                  name={place.key}
                  alt={t(`places.items.${place.key}.alt`)}
                  sizes={CARD_SIZES}
                  style={{ height: 420 }}
                />
                <span className="label">{t(`places.filters.${place.cat}`)}</span>
                <span className="t">{t(`places.items.${place.key}.title`)}</span>
                <span className="d">{t(`places.items.${place.key}.text`)}</span>
              </div>
            ))}
          </div>
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

// The village story: the published history page (its title as the large serif
// paragraph, its Markdown body below). The design's placeholders stand in while
// the page is unpublished or cannot be loaded.
async function Story({ locale }: { locale: string }) {
  const t = await getTranslations("Discover");

  let page: PageDto | null = null;
  try {
    page = await getPage("history", locale);
  } catch {
    // API down: placeholders below.
  }

  const big = { margin: 0, fontSize: 34, lineHeight: 1.35 };
  if (!page) {
    return (
      <>
        <p className="serif" style={big}>
          {t("story.placeholderTitle")}
        </p>
        <p className="lead">{t("story.placeholderBody")}</p>
      </>
    );
  }

  return (
    <>
      <LanguageNote language={page.language} locale={locale} />
      <div
        lang={page.language}
        dir={directionOf(page.language)}
        style={{ display: "flex", flexDirection: "column", gap: 22 }}
      >
        <p className="serif" style={big}>
          {page.title}
        </p>
        <Markdown site>{page.body}</Markdown>
      </div>
    </>
  );
}
