import { Suspense, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { directionOf } from "@/components/LanguageNote";
import { Link } from "@/i18n/navigation";
import { getNews, type NewsSummaryDto } from "@/lib/api";
import { formatDate } from "@/lib/numbers";

const SAMPLES = ["water", "fees", "roads", "council"] as const;

// The green "Official notices" panel. It lists the latest published news (date
// and title, linking to the article). The frame renders at once; the list is
// fetched live, so it streams in behind <Suspense>.
export function Notices({
  locale,
  count,
  showAll = false,
  style,
}: {
  locale: string;
  count: 3 | 4;
  showAll?: boolean;
  style?: CSSProperties;
}) {
  const t = useTranslations("Notices");

  return (
    <aside className="side notices" style={style} data-reveal>
      <span className="label">{t("label")}</span>
      <Suspense fallback={null}>
        <NoticeList locale={locale} count={count} />
      </Suspense>
      {showAll && (
        <Link className="tlink" href="/news">
          {t("all")}
        </Link>
      )}
    </aside>
  );
}

async function NoticeList({ locale, count }: { locale: string; count: 3 | 4 }) {
  const t = await getTranslations("Notices");

  let items: NewsSummaryDto[] = [];
  try {
    items = (await getNews(locale, 1, count)).items;
  } catch {
    // API down: fall through to the sample notices below.
  }

  // Nothing published yet: the design's sample notices (placeholders).
  if (items.length === 0) {
    const samples = count === 3 ? SAMPLES.filter((s) => s !== "roads") : SAMPLES;
    return samples.map((s) => (
      <div key={s} className="notice">
        <small>{t(`sample.${s}.meta`)}</small>
        <span>{t(`sample.${s}.title`)}</span>
      </div>
    ));
  }

  return items.map((item) => (
    <Link key={item.id} className="notice" href={`/news/${item.slug}`}>
      <small>
        <time dateTime={item.publishedAt}>
          {formatDate(item.publishedAt, locale, { dateStyle: "long" })}
        </time>
      </small>
      <span lang={item.language} dir={directionOf(item.language)}>
        {item.title}
      </span>
    </Link>
  ));
}
