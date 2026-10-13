import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { cache } from "react";
import { hasLocale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowIcon } from "@/components/ArrowIcon";
import { ClipReveal } from "@/components/motion/ClipReveal";
import { Link } from "@/i18n/navigation";
import { getDirection, routing } from "@/i18n/routing";
import { getNewsBySlug, type NewsDto } from "@/lib/api";

// Cache Components needs at least one param to prerender the route shell. This
// placeholder only produces the shell; real slugs render on demand.
export function generateStaticParams() {
  return [{ slug: "_" }];
}

// One request per render, shared by generateMetadata and the page.
const loadArticle = cache(
  async (locale: string, slug: string): Promise<NewsDto | null | undefined> => {
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
  const t = await getTranslations({ locale, namespace: "Nav" });
  const article = await loadArticle(locale, slug);
  if (article) return { title: `${article.title} | ${t("brand")}` };
  return { title: `${t("news")} | ${t("brand")}` };
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
  const article = await loadArticle(locale, slug);
  if (article === null) notFound();

  return (
    <div className="section-y">
      <div className="page-container">
        <Link
          href="/news"
          className="inline-flex min-h-11 items-center gap-2 font-semibold underline-offset-4 hover:underline"
        >
          <ArrowIcon className="size-5 -scale-x-100 rtl:scale-x-100" />
          {t("back")}
        </Link>
        {article === undefined ? (
          <p role="status" className="mt-12 max-w-prose text-ink/80">
            {t("articleError")}
          </p>
        ) : (
          <Article locale={locale} article={article} />
        )}
      </div>
    </div>
  );
}

// Text direction of the returned language ("auto" if it is not one we know).
function directionOf(language: string): "rtl" | "ltr" | "auto" {
  return hasLocale(routing.locales, language) ? getDirection(language) : "auto";
}

async function Article({ locale, article }: { locale: string; article: NewsDto }) {
  const t = await getTranslations("News");
  const format = await getFormatter();

  const differs = article.language !== locale;
  const paragraphs = article.body.split(/\n{2,}/).filter((p) => p.trim() !== "");

  return (
    <article className="mt-8 md:mt-12">
      {differs && (
        <p role="note" className="mb-6 text-sm text-ink/70">
          {hasLocale(routing.locales, article.language)
            ? t("onlyIn", { language: t(`languages.${article.language}`) })
            : t("onlyInOther")}
        </p>
      )}
      <div lang={article.language} dir={directionOf(article.language)}>
        <time dateTime={article.publishedAt} className="text-sm text-ink/70">
          {format.dateTime(new Date(article.publishedAt), { dateStyle: "long" })}
        </time>
        <h1 className="mt-2 max-w-3xl text-2xl leading-tight font-bold md:text-3xl">
          {article.title}
        </h1>
        {/* PLACEHOLDER: the API has no image field yet */}
        <ClipReveal className="mt-8 max-w-3xl">
          <div className="relative aspect-[3/2] overflow-hidden rounded-card bg-sand">
            <Image
              src="/images/news-placeholder.jpg"
              alt=""
              fill
              sizes="(min-width: 768px) 48rem, 100vw"
              className="object-cover"
            />
          </div>
        </ClipReveal>
        <div className="mt-8 max-w-prose space-y-5">
          {paragraphs.map((p, i) => (
            <p key={i} className="whitespace-pre-line">
              {p.trim()}
            </p>
          ))}
        </div>
      </div>
    </article>
  );
}
