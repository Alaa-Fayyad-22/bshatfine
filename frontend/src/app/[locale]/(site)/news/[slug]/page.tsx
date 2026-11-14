import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { hasLocale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { directionOf, LanguageNote } from "@/components/LanguageNote";
import { DEFAULT_COVER } from "@/components/NewsCover";
import { Hero } from "@/components/site/Hero";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { coverUrl, getNewsBySlug, type NewsDto } from "@/lib/api";

// Cache Components needs at least one param to prerender the route shell. This
// placeholder only produces the shell; real slugs render on demand.
const SHELL_SLUG = "_";

export function generateStaticParams() {
  return [{ slug: SHELL_SLUG }];
}

// This page blocks on purpose (see Page below): an unknown slug must answer with
// a real 404, which is only possible before any <Suspense> fallback streams.
// Tell the dev-time instant-navigation check that this is intended.
export const instant = false;

// One request per render, shared by generateMetadata and the page.
const loadArticle = cache(
  async (locale: string, slug: string): Promise<NewsDto | null | undefined> => {
    // Building the shell must never depend on the API being up (and the
    // placeholder is not an article anyway).
    if (slug === SHELL_SLUG) return null;
    try {
      return await getNewsBySlug(locale, slug);
    } catch {
      return undefined; // API down
    }
  },
);

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/news/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Meta" });
  const article = await loadArticle(locale, slug);
  if (article) {
    const title = t("pages.article", { title: article.title });
    const cover = coverUrl(article.coverImageUrl);
    // Absolute URLs, so shared links show the photo. Without a cover the
    // site-wide defaults apply.
    return {
      title,
      ...(cover && {
        openGraph: { title, type: "article", images: [{ url: cover, alt: article.title }] },
        twitter: { card: "summary_large_image", title, images: [cover] },
      }),
    };
  }
  return { title: t("pages.news") };
}

// The hero title shrinks in two steps for long headlines, so it never overflows.
function titleSize(title: string): string | undefined {
  const length = Array.from(title).length;
  if (length > 80) return "xlong";
  if (length > 28) return "long";
  return undefined;
}

// The article is fetched here, before any <Suspense> boundary (and with no
// loading.tsx, which would be one), so an unknown slug can still produce a
// real HTTP 404. Once a fallback has streamed, the status is stuck at 200.
// getNewsBySlug is cached, which is what lets the route resolve it up front.
export default async function Page({ params }: PageProps<"/[locale]/news/[slug]">) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("News");
  const tn = await getTranslations("Nav");
  const article = await loadArticle(locale, slug);
  if (article === null) notFound();

  const crumbs = [{ label: tn("news"), href: "/news" }];
  const back = (
    <Link className="tlink" href="/news" style={{ alignSelf: "flex-start" }}>
      {t("back")}
    </Link>
  );
  const column = { maxWidth: 760, display: "flex", flexDirection: "column", gap: 22 } as const;

  // API down: the News hero and a message, never a broken page.
  if (article === undefined) {
    return (
      <>
        <Hero
          image={DEFAULT_COVER}
          alt={t("hero.alt")}
          crumbs={crumbs}
          kicker={t("hero.kicker")}
          title={t("hero.title")}
        />
        <section className="section">
          <div className="wrap">
            <div style={column}>
              <p role="status" className="lead">
                {t("articleError")}
              </p>
              {back}
            </div>
          </div>
        </section>
      </>
    );
  }

  const format = await getFormatter();
  const cover = coverUrl(article.coverImageUrl);
  const paragraphs = article.body.split(/\n{2,}/).filter((p) => p.trim() !== "");

  return (
    <>
      <Hero
        image={cover ?? DEFAULT_COVER}
        alt={cover ? article.title : t("defaultCoverAlt")}
        crumbs={crumbs}
        kicker={
          <time dateTime={article.publishedAt}>
            {format.dateTime(new Date(article.publishedAt), { dateStyle: "long" })}
          </time>
        }
        title={article.title}
        titleClassName={titleSize(article.title)}
        titleLang={article.language}
        titleDir={directionOf(article.language)}
      />

      <section className="section">
        <div className="wrap">
          <article style={column}>
            <LanguageNote language={article.language} locale={locale} />
            <div
              lang={article.language}
              dir={directionOf(article.language)}
              style={{ display: "flex", flexDirection: "column", gap: 22 }}
            >
              {paragraphs.map((p, i) => (
                <p key={i} className="lead" style={{ whiteSpace: "pre-line" }}>
                  {p.trim()}
                </p>
              ))}
            </div>
            {back}
          </article>
        </div>
      </section>
    </>
  );
}
