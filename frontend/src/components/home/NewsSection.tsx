import Image from "next/image";
import { Suspense } from "react";
import { getFormatter, getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { ArrowIcon } from "@/components/ArrowIcon";
import { Link } from "@/i18n/navigation";
import { getNews, type NewsDto } from "@/lib/api";
import { excerpt } from "@/lib/text";

// The heading renders immediately; the list streams in behind <Suspense>
// (required by Cache Components, since the API call is uncached).
export function NewsSection() {
  const t = useTranslations("Home.News");

  return (
    <section aria-labelledby="news-title" className="section-y">
      <div className="page-container">
        <div className="flex items-end justify-between gap-6">
          <h2 id="news-title" className="text-3xl font-bold md:text-4xl">
            {t("title")}
          </h2>
          <Link
            href="/news"
            className="inline-flex min-h-11 items-center gap-2 font-semibold underline-offset-4 hover:underline"
          >
            {t("all")}
            <ArrowIcon className="size-5" />
          </Link>
        </div>

        <Suspense fallback={<NewsSkeleton label={t("loading")} />}>
          <NewsContent />
        </Suspense>
      </div>
    </section>
  );
}

async function loadNews(): Promise<NewsDto[] | null> {
  try {
    const items = await getNews(1, 4);
    return [...items].sort(
      (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
    );
  } catch {
    // API down or slow: the page still renders, with a message instead.
    return null;
  }
}

async function NewsContent() {
  const t = await getTranslations("Home.News");
  const format = await getFormatter();
  const items = await loadNews();

  if (items === null) {
    return (
      <p role="status" className="mt-12 max-w-prose text-ink/80">
        {t("error")}
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <p className="mt-12 max-w-prose text-ink/80">{t("empty")}</p>
    );
  }

  const [featured, ...others] = items;
  const date = (iso: string) => (
    <time dateTime={iso} className="text-sm text-ink/70">
      {format.dateTime(new Date(iso), { dateStyle: "long" })}
    </time>
  );

  return (
    <div className="mt-10 grid gap-12 md:mt-14 lg:grid-cols-5 lg:gap-16">
      <article className="lg:col-span-3">
        {/* PLACEHOLDER: the API has no image field yet */}
        <div className="relative aspect-[3/2] overflow-hidden rounded-card bg-sand">
          <Image
            src="/images/news-placeholder.jpg"
            alt=""
            fill
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-cover"
          />
        </div>
        <h3 className="mt-6 text-2xl leading-snug font-bold md:text-3xl">
          <Link href="/news" className="hover:underline">
            {featured.title}
          </Link>
        </h3>
        <p className="mt-3 line-clamp-3 max-w-prose text-ink/80">
          {excerpt(featured.body)}
        </p>
        <p className="mt-4">{date(featured.publishedAt)}</p>
      </article>

      {others.length > 0 && (
        <ul className="self-start border-t border-hairline lg:col-span-2">
          {others.slice(0, 3).map((item) => (
            <li key={item.id} className="border-b border-hairline py-6">
              <p>{date(item.publishedAt)}</p>
              <h3 className="mt-1 text-lg leading-snug font-semibold md:text-xl">
                <Link href="/news" className="hover:underline">
                  {item.title}
                </Link>
              </h3>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewsSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="mt-10 grid gap-12 md:mt-14 lg:grid-cols-5 lg:gap-16"
    >
      <div className="lg:col-span-3">
        <div className="aspect-[3/2] animate-pulse rounded-card bg-sand motion-reduce:animate-none" />
        <div className="mt-6 h-8 w-3/4 animate-pulse bg-sand motion-reduce:animate-none" />
      </div>
      <div className="space-y-6 lg:col-span-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse border-b border-hairline bg-sand motion-reduce:animate-none"
          />
        ))}
      </div>
    </div>
  );
}
