import { useLocale, useTranslations } from "next-intl";
import { directionOf, LanguageNote } from "@/components/LanguageNote";
import { SiteImage } from "@/components/SiteImage";
import { CATEGORY_CLASS, isEventCategory } from "@/config/events";
import { Link } from "@/i18n/navigation";
import type { EventSummaryDto } from "@/lib/api";
import { coverUrl } from "@/lib/cover";
import { formatEventWhen } from "@/lib/event-time";

// The picture of an event without a cover of its own.
export const EVENT_DEFAULT_COVER = "/images/festival.jpg";

// Category tag of an event (nothing for a code this site does not know).
export function EventCategoryTag({ category }: { category: string }) {
  const t = useTranslations("Events");
  if (!isEventCategory(category)) return null;
  return <span className={`tag ${CATEGORY_CLASS[category]}`}>{t(`categories.${category}`)}</span>;
}

// One event in the lists of /events: cover, category, date (Beirut time),
// title, summary and place. All text is plain text.
export function EventCard({ event }: { event: EventSummaryDto }) {
  const t = useTranslations("Events");
  const locale = useLocale();
  const cover = coverUrl(event.coverImageUrl);
  const dir = directionOf(event.language);

  return (
    <article data-reveal style={{ minWidth: 0 }}>
      <Link className="pcard" href={`/events/${event.id}`}>
        <SiteImage
          src={cover ?? EVENT_DEFAULT_COVER}
          alt={cover ? event.title : t("defaultCoverAlt")}
          width={840}
          height={560}
          sizes="(max-width: 700px) 100vw, 440px"
          style={{ height: 240 }}
        />
        <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 14px" }}>
          <EventCategoryTag category={event.category} />
          <span className="label">
            <time dateTime={event.startsAt}>{formatEventWhen(locale, event)}</time>
          </span>
        </span>
        <span className="t" lang={event.language} dir={dir} style={{ overflowWrap: "anywhere" }}>
          {event.title}
        </span>
        <span className="d" lang={event.language} dir={dir} style={{ overflowWrap: "anywhere" }}>
          {event.summary}
        </span>
        {/* Not translated (the API fell back to Arabic): say so, as on news cards. */}
        <LanguageNote language={event.language} locale={locale} of="Events" />
        {event.location.trim() !== "" && (
          <span className="d" style={{ fontSize: 14, overflowWrap: "anywhere" }}>
            <span style={{ color: "var(--clay)" }}>{t("location")}: </span>
            <span lang={event.language} dir={dir}>
              {event.location}
            </span>
          </span>
        )}
      </Link>
    </article>
  );
}
