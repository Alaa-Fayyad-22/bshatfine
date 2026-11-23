import type { Metadata } from "next";
import { SiteImage } from "@/components/SiteImage";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { hasLocale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { directionOf, LanguageNote } from "@/components/LanguageNote";
import { DEFAULT_COVER } from "@/components/NewsCover";
import { Hero } from "@/components/site/Hero";
import { Notices } from "@/components/site/Notices";
import { photoSrc } from "@/components/site/Photo";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { coverUrl, getNews, type NewsPage } from "@/lib/api";
import { pageMetadata } from "@/lib/site-meta";

const PAGE_SIZE = 10;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/news">): Promise<Metadata> {
  return pageMetadata((await params).locale, "news");
}

export default async function Page({ params, searchParams }: PageProps<"/[locale]/news">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("News");
  const tn = await getTranslations("Nav");

  // The frame is static; only the list depends on ?page=N, so it streams in
  // behind <Suspense>.
  return (
    <>
      <Hero
        image={photoSrc("festival")}
        alt={t("hero.alt")}
        crumbs={[{ label: tn("news") }]}
        kicker={t("hero.kicker")}
        title={t("hero.title")}
      />

      <section className="section">
        <div className="wrap split">
          <div className="main">
            <Suspense
              fallback={
                <p role="status" className="lead">
                  {t("loading")}
                </p>
              }
            >
              <NewsList locale={locale} searchParams={searchParams} />
            </Suspense>
          </div>
          <Notices locale={locale} count={4} style={{ alignSelf: "flex-start" }} />
        </div>
      </section>
    </>
  );
}

function parsePage(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

async function loadPage(locale: string, page: number): Promise<NewsPage | null> {
  try {
    return await getNews(locale, page, PAGE_SIZE);
  } catch {
    // API down or slow: the page still renders, with a message instead.
    return null;
  }
}

async function NewsList({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: PageProps<"/[locale]/news">["searchParams"];
}) {
  const page = parsePage((await searchParams).page);
  const t = await getTranslations("News");
  const format = await getFormatter();
  const result = await loadPage(locale, page);

  if (result === null) {
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
        <p className="lead">{t("pageOutOfRange")}</p>
        <Link className="tlink" href="/news" style={{ alignSelf: "flex-start" }}>
          {t("goToFirst")}
        </Link>
      </div>
    );
  }

  if (items.length === 0) return <p className="lead">{t("empty")}</p>;

  return (
    <>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
        {items.map((item) => {
          const cover = coverUrl(item.coverImageUrl);
          return (
            <article key={item.id} data-reveal>
              <Link className="pcard" href={`/news/${item.slug}`}>
                {/* The article's cover (title as alt text) or the default photo. */}
                <SiteImage
                  src={cover ?? DEFAULT_COVER}
                  alt={cover ? item.title : t("defaultCoverAlt")}
                  width={840}
                  height={560}
                  sizes="(max-width: 700px) 100vw, 440px"
                  style={{ height: 260 }}
                />
                <span className="label">
                  <time dateTime={item.publishedAt}>
                    {format.dateTime(new Date(item.publishedAt), { dateStyle: "long" })}
                  </time>
                </span>
                <span className="t" lang={item.language} dir={directionOf(item.language)}>
                  {item.title}
                </span>
                <LanguageNote language={item.language} locale={locale} />
                <span className="tlink">{t("read")}</span>
              </Link>
            </article>
          );
        })}
      </div>

      {totalPages > 1 && (
        <nav className="filters" style={{ margin: "36px 0 0" }} aria-label={t("pagination")}>
          {page > 1 && (
            <Link
              href={page - 1 === 1 ? "/news" : { pathname: "/news", query: { page: page - 1 } }}
              rel="prev"
            >
              {t("previous")}
            </Link>
          )}
          <span className="now" aria-current="page">
            {t("page", { page, total: totalPages })}
          </span>
          {page < totalPages && (
            <Link href={{ pathname: "/news", query: { page: page + 1 } }} rel="next">
              {t("next")}
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
