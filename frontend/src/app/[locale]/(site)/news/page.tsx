import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { hasLocale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowIcon } from "@/components/ArrowIcon";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getNews, type NewsPage } from "@/lib/api";
import { excerpt } from "@/lib/text";

const PAGE_SIZE = 10;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/news">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Nav" });
  return { title: `${t("news")} | ${t("brand")}` };
}

export default async function Page({ params, searchParams }: PageProps<"/[locale]/news">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("News");

  // The heading and intro are static; only the list depends on ?page=N, so it
  // streams in behind <Suspense>.
  return (
    <div className="section-y">
      <div className="page-container">
        <h1 className="text-4xl font-bold md:text-5xl">{t("title")}</h1>
        <p className="mt-4 max-w-prose text-ink/80">{t("intro")}</p>
        <Suspense fallback={<ListSkeleton label={t("loading")} />}>
          <NewsList locale={locale} searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
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
      <p role="status" className="mt-12 max-w-prose text-ink/80">
        {t("error")}
      </p>
    );
  }

  const { items, totalPages } = result;

  // Asked for a page past the end: say so and point back to page 1.
  if (page > Math.max(totalPages, 1)) {
    return (
      <div role="status" className="mt-12 max-w-prose text-ink/80">
        <p>{t("pageOutOfRange")}</p>
        <Link
          href="/news"
          className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
        >
          {t("goToFirst")}
        </Link>
      </div>
    );
  }

  const hasNext = page < totalPages;
  const hasPrevious = page > 1;

  return (
    <>
      {items.length === 0 ? (
        <p className="mt-12 max-w-prose text-ink/80">{t("empty")}</p>
      ) : (
        <ul className="mt-10 border-t border-hairline md:mt-14">
          {items.map((item) => (
            <li key={item.id} className="border-b border-hairline py-8">
              <article className="grid gap-6 sm:grid-cols-[12rem_1fr] sm:gap-8">
                {/* PLACEHOLDER: the API has no image field yet */}
                <div className="relative aspect-[3/2] overflow-hidden rounded-card bg-sand">
                  <Image
                    src="/images/news-placeholder.jpg"
                    alt=""
                    fill
                    sizes="(min-width: 640px) 12rem, 100vw"
                    className="object-cover"
                  />
                </div>
                <div>
                  <time dateTime={item.publishedAt} className="text-sm text-ink/70">
                    {format.dateTime(new Date(item.publishedAt), { dateStyle: "long" })}
                  </time>
                  <h2
                    lang={item.language}
                    dir="auto"
                    className="mt-1 text-lg leading-snug font-bold md:text-xl"
                  >
                    <Link href={`/news/${item.slug}`} className="hover:underline">
                      {item.title}
                    </Link>
                  </h2>
                  <p lang={item.language} dir="auto" className="mt-3 max-w-prose text-ink/80">
                    {excerpt(item.body, 160)}
                  </p>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav
          aria-label={t("pagination")}
          className="mt-10 flex items-center justify-between gap-6"
        >
          {hasPrevious ? (
            <Link
              href={page - 1 === 1 ? "/news" : { pathname: "/news", query: { page: page - 1 } }}
              rel="prev"
              className="inline-flex min-h-11 items-center gap-2 font-semibold underline-offset-4 hover:underline"
            >
              <ArrowIcon className="size-5 -scale-x-100 rtl:scale-x-100" />
              {t("previous")}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-ink/70">{t("page", { page, total: totalPages })}</span>
          {hasNext ? (
            <Link
              href={{ pathname: "/news", query: { page: page + 1 } }}
              rel="next"
              className="inline-flex min-h-11 items-center gap-2 font-semibold underline-offset-4 hover:underline"
            >
              {t("next")}
              <ArrowIcon className="size-5" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}

function ListSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="mt-10 border-t border-hairline md:mt-14">
      {[0, 1, 2].map((i) => (
        <div key={i} className="border-b border-hairline py-8">
          <div className="h-32 animate-pulse rounded-card bg-sand motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}
