import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { directionOf } from "@/components/LanguageNote";
import { HOME_UPCOMING } from "@/config/events";
import { Link } from "@/i18n/navigation";
import { getUpcomingEvents, type EventSummaryDto } from "@/lib/api";
import { eventDateBox, formatEventTime, formatEventWhen } from "@/lib/event-time";

// The home page's "Coming up" rows: the next published events from the API
// (date box, title, time and place, "Details"), then a link to all events.
// The list is read live, so it streams in behind <Suspense>.
export function EventRows({ locale, allLabel }: { locale: string; allLabel: string }) {
  return (
    <>
      <Suspense fallback={<div className="events-list" />}>
        <UpcomingRows locale={locale} />
      </Suspense>
      <Link className="tlink" href="/events" style={{ marginTop: 28 }}>
        {allLabel}
      </Link>
    </>
  );
}

async function UpcomingRows({ locale }: { locale: string }) {
  const t = await getTranslations("Events");
  let events: EventSummaryDto[] | null;
  try {
    events = await getUpcomingEvents(locale, HOME_UPCOMING);
  } catch {
    events = null; // API down: a calm line instead of the list
  }

  if (events === null || events.length === 0) {
    return (
      <p className="lead" style={{ marginBottom: 8 }}>
        {events === null ? t("homeError") : t("homeEmpty")}
      </p>
    );
  }

  return (
    <div className="events-list">
      {events.map((e) => {
        const box = eventDateBox(locale, e.startsAt);
        const dir = directionOf(e.language);
        const when = e.isAllDay ? formatEventWhen(locale, e) : formatEventTime(locale, e.startsAt);
        return (
          <Link key={e.id} href={`/events/${e.id}`} data-reveal>
            <time className="date" dateTime={e.startsAt} style={{ textAlign: "center" }}>
              <span className="label">{box.weekday}</span>
              <span className="dd">{box.day}</span>
              <span className="label">{box.month}</span>
            </time>
            <div className="ev">
              <span className="t" lang={e.language} dir={dir}>
                {e.title}
              </span>
              <span className="m">
                {when}
                {e.location.trim() !== "" && (
                  <>
                    {" · "}
                    <span lang={e.language} dir={dir}>
                      {e.location}
                    </span>
                  </>
                )}
              </span>
            </div>
            <span className="tlink">{t("details")}</span>
          </Link>
        );
      })}
    </div>
  );
}
