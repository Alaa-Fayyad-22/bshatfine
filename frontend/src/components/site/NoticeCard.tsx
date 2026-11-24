import { getTranslations } from "next-intl/server";
import { directionOf } from "@/components/LanguageNote";
import { isNoticeCategory, isNoticePriority, PRIORITY_CLASS } from "@/config/notices";
import { Link } from "@/i18n/navigation";
import type { NoticeSummaryDto } from "@/lib/api";
import { formatEventWhen } from "@/lib/event-time";

// "20 December 2026, 18:00" in Beirut time, in the digits of the page.
export const noticeTime = (locale: string, iso: string) =>
  formatEventWhen(locale, { startsAt: iso, endsAt: null, isAllDay: false });

// One notice in the public lists (current notices and the archive): priority
// badge (colour AND word), category, title linking to its page, area and validity.
export async function NoticeCard({ notice: n, locale }: { notice: NoticeSummaryDto; locale: string }) {
  const t = await getTranslations("Notices");
  const dir = directionOf(n.language);
  const priority = isNoticePriority(n.priority) ? n.priority : null;
  const category = isNoticeCategory(n.category) ? n.category : null;

  return (
    <li
      style={{
        borderTop: "1px solid #cfc7b9",
        padding: "22px 0",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 12px" }}>
        {priority && <span className={PRIORITY_CLASS[priority]}>{t(`priorities.${priority}`)}</span>}
        {category && (
          <span className="label" style={{ color: "var(--muted)" }}>
            {t(`categories.${category}`)}
          </span>
        )}
        {n.isExpired && (
          <span className="tag st-plan">{t("expired")}</span>
        )}
      </div>
      <h3 className="serif" style={{ margin: 0, fontSize: 26, fontWeight: 600, lineHeight: 1.25 }}>
        <Link href={`/notices/${n.id}`} lang={n.language} dir={dir} style={{ textDecoration: "none" }}>
          {n.title}
        </Link>
      </h3>
      {(n.area.trim() !== "" || n.validFrom || n.validUntil) && (
        <p style={{ margin: 0, fontSize: 15, color: "var(--muted)", overflowWrap: "anywhere" }}>
          {n.area.trim() !== "" && (
            <span lang={n.language} dir={dir}>
              {n.area}
            </span>
          )}
          {n.area.trim() !== "" && (n.validFrom || n.validUntil) && " · "}
          {n.validFrom && (
            <time dateTime={n.validFrom}>{t("validFrom", { date: noticeTime(locale, n.validFrom) })}</time>
          )}
          {n.validFrom && n.validUntil && " · "}
          {n.validUntil && (
            <time dateTime={n.validUntil}>{t("validUntil", { date: noticeTime(locale, n.validUntil) })}</time>
          )}
        </p>
      )}
    </li>
  );
}
