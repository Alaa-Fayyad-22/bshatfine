import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Hero } from "@/components/site/Hero";
import { NoticeCard } from "@/components/site/NoticeCard";
import { photoSrc } from "@/components/site/Photo";
import {
  ACTIVE_LIMIT,
  ARCHIVE_PAGE_SIZE,
  isNoticeCategory,
  NOTICE_CATEGORIES,
  type NoticeCategory,
} from "@/config/notices";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getActiveNotices, getNoticeArchive, type NoticePage, type NoticeSummaryDto } from "@/lib/api";
import { formatNumber } from "@/lib/numbers";
import { pageMetadata } from "@/lib/site-meta";

type SearchParams = PageProps<"/[locale]/notices">["searchParams"];

export async function generateMetadata({ params }: PageProps<"/[locale]/notices">): Promise<Metadata> {
  const { locale } = await params;
  const meta = await pageMetadata(locale, "notices");
  if (!hasLocale(routing.locales, locale)) return meta;
  const t = await getTranslations({ locale, namespace: "Notices" });
  return { ...meta, description: t("description") };
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// ?category=water. An unknown code is never sent to the API (it would answer
// 400): the page shows all notices and says so.
function parseCategory(value: string | string[] | undefined): { category: NoticeCategory | null; unknown: boolean } {
  const raw = first(value)?.trim().toLowerCase();
  if (!raw) return { category: null, unknown: false };
  return isNoticeCategory(raw) ? { category: raw, unknown: false } : { category: null, unknown: true };
}

function parsePage(value: string | string[] | undefined): number {
  const n = Number(first(value));
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

const listHref = (category: NoticeCategory | null, page = 1, hash?: string) => {
  const query: Record<string, string> = {};
  if (category) query.category = category;
  if (page > 1) query.page = String(page);
  return { pathname: "/notices" as const, query, ...(hash && { hash }) };
};

const LIST = { listStyle: "none", margin: 0, padding: 0, borderBottom: "1px solid #cfc7b9" } as const;

export default async function Page({ params, searchParams }: PageProps<"/[locale]/notices">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Notices");
  const tn = await getTranslations("Nav");

  const loading = (
    <p role="status" className="lead">
      {t("loading")}
    </p>
  );

  // The frame is static; the filter and both lists depend on the query string
  // and are read live, so they stream in behind <Suspense>.
  return (
    <>
      <Hero
        image={photoSrc("aerial")}
        alt={t("hero.alt")}
        crumbs={[{ label: tn("notices") }]}
        kicker={t("hero.kicker")}
        title={t("hero.title")}
      />

      <section className="section" aria-labelledby="active-title">
        <div className="wrap">
          <div style={{ marginBottom: 36 }}>
            <span className="kicker">{t("active.kicker")}</span>
            <h2 id="active-title" className="title">
              {t("active.title")}
            </h2>
          </div>
          <Suspense fallback={loading}>
            <Active locale={locale} searchParams={searchParams} />
          </Suspense>
        </div>
      </section>

      <section id="archive" className="section band" aria-labelledby="archive-title">
        <div className="wrap">
          <div style={{ marginBottom: 36 }}>
            <span className="kicker">{t("archive.kicker")}</span>
            <h2 id="archive-title" className="title">
              {t("archive.title")}
            </h2>
          </div>
          <Suspense fallback={loading}>
            <Archive locale={locale} searchParams={searchParams} />
          </Suspense>
        </div>
      </section>
    </>
  );
}

async function CategoryChips({ current }: { current: NoticeCategory | null }) {
  const t = await getTranslations("Notices");
  const chip = (category: NoticeCategory | null, label: string) =>
    category === current ? (
      <span key={category ?? "all"} className="now" aria-current="page">
        {label}
      </span>
    ) : (
      <Link key={category ?? "all"} href={listHref(category)} scroll={false}>
        {label}
      </Link>
    );
  return (
    <nav className="filters" aria-label={t("filtersLabel")}>
      {chip(null, t("allCategories"))}
      {NOTICE_CATEGORIES.map((c) => chip(c, t(`categories.${c}`)))}
    </nav>
  );
}

async function Active({ locale, searchParams }: { locale: string; searchParams: SearchParams }) {
  const { category, unknown } = parseCategory((await searchParams).category);
  const t = await getTranslations("Notices");

  let notices: NoticeSummaryDto[] | null;
  try {
    notices = await getActiveNotices(locale, ACTIVE_LIMIT, category);
  } catch {
    notices = null;
  }

  return (
    <>
      <CategoryChips current={category} />
      {unknown && (
        <p role="status" className="lead" style={{ marginBottom: 22 }}>
          {t("unknownCategory")}
        </p>
      )}
      {notices === null ? (
        <p role="status" className="lead">
          {t("error")}
        </p>
      ) : notices.length === 0 ? (
        <p className="lead">{category ? t("active.emptyCategory") : t("active.empty")}</p>
      ) : (
        // In the API's order: urgent, then important, then normal (newest first in each).
        <ul style={LIST}>
          {notices.map((n) => (
            <NoticeCard key={n.id} notice={n} locale={locale} />
          ))}
        </ul>
      )}
    </>
  );
}

async function Archive({ locale, searchParams }: { locale: string; searchParams: SearchParams }) {
  const sp = await searchParams;
  const { category } = parseCategory(sp.category);
  const page = parsePage(sp.page);
  const t = await getTranslations("Notices");

  let result: NoticePage;
  try {
    result = await getNoticeArchive(locale, page, ARCHIVE_PAGE_SIZE, category);
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
        <p className="lead">{t("archive.pageOutOfRange")}</p>
        <Link className="tlink" href={listHref(category, 1, "archive")} style={{ alignSelf: "flex-start" }}>
          {t("archive.goToFirst")}
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="lead">{category ? t("archive.emptyCategory") : t("archive.empty")}</p>;
  }

  return (
    <>
      <ul style={LIST}>
        {items.map((n) => (
          <NoticeCard key={n.id} notice={n} locale={locale} />
        ))}
      </ul>

      {totalPages > 1 && (
        <nav className="filters" style={{ margin: "36px 0 0" }} aria-label={t("archive.pagination")}>
          {page > 1 && (
            <Link href={listHref(category, page - 1, "archive")} rel="prev">
              {t("archive.previous")}
            </Link>
          )}
          <span className="now" aria-current="page">
            {t("archive.page", { page: formatNumber(page, locale), total: formatNumber(totalPages, locale) })}
          </span>
          {page < totalPages && (
            <Link href={listHref(category, page + 1, "archive")} rel="next">
              {t("archive.next")}
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
