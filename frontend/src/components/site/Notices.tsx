import { Suspense, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { directionOf } from "@/components/LanguageNote";
import { isNoticeCategory, isNoticePriority, PRIORITY_CLASS } from "@/config/notices";
import { Link } from "@/i18n/navigation";
import { getActiveNotices, type NoticeSummaryDto } from "@/lib/api";
import { EVENT_TIME_ZONE } from "@/lib/event-time";
import { formatDate } from "@/lib/numbers";

// The green "Official notices" panel (home page, news page). It lists the
// latest ACTIVE notices from the API, urgent first (priority badge, category,
// date, title, area), each linking to its own page. The frame renders at once;
// the list is fetched live, so it streams in behind <Suspense>.
export function Notices({
  locale,
  count,
  showAll = false,
  style,
}: {
  locale: string;
  count: number;
  showAll?: boolean;
  style?: CSSProperties;
}) {
  const t = useTranslations("Notices");

  return (
    <aside className="side notices" style={style} data-reveal aria-labelledby="notices-panel-label">
      <span className="label" id="notices-panel-label">
        {t("label")}
      </span>
      <Suspense fallback={null}>
        <NoticeList locale={locale} count={count} />
      </Suspense>
      {showAll && (
        <Link className="tlink" href="/notices">
          {t("all")}
        </Link>
      )}
    </aside>
  );
}

async function NoticeList({ locale, count }: { locale: string; count: number }) {
  const t = await getTranslations("Notices");

  let items: NoticeSummaryDto[] | null;
  try {
    items = await getActiveNotices(locale, count);
  } catch {
    items = null; // API down: a calm line instead of the list
  }

  if (items === null || items.length === 0) {
    return (
      <p style={{ margin: 0, color: "#e9e2d6" }}>{items === null ? t("homeError") : t("homeEmpty")}</p>
    );
  }

  return items.map((n) => {
    const dir = directionOf(n.language);
    const date = n.publishedAt;
    return (
      <Link key={n.id} className="notice" href={`/notices/${n.id}`}>
        <small className="nmeta">
          {isNoticePriority(n.priority) && (
            <span className={PRIORITY_CLASS[n.priority]}>{t(`priorities.${n.priority}`)}</span>
          )}
          {isNoticeCategory(n.category) && <span>{t(`categories.${n.category}`)}</span>}
          {date && (
            <time dateTime={date}>
              {formatDate(date, locale, { dateStyle: "long", timeZone: EVENT_TIME_ZONE })}
            </time>
          )}
        </small>
        <span lang={n.language} dir={dir}>
          {n.title}
        </span>
        {n.area.trim() !== "" && (
          <small lang={n.language} dir={dir}>
            {n.area}
          </small>
        )}
      </Link>
    );
  });
}
