import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

// PLACEHOLDER: static sample events, exactly as in the approved design (there
// is no events back end yet). The bracketed parts are placeholders on purpose.
const EVENTS = [
  { key: "independence", tone: "st-on" },
  { key: "health", tone: "st-done" },
  { key: "market", tone: "st-on" },
  { key: "cleanup", tone: "st-done" },
  { key: "council", tone: "st-plan", atHall: true },
] as const;

// "home": the first three, each with a "Details" link. "events": all five,
// each with its category tag.
export function EventRows({ variant }: { variant: "home" | "events" }) {
  const t = useTranslations("SampleEvents");
  const events = variant === "home" ? EVENTS.slice(0, 3) : EVENTS;

  return (
    <div className="events-list">
      {events.map((e) => (
        <Link key={e.key} href="/events" data-reveal>
          <div className="date">
            <span className="label ph">{t("day")}</span>
            <span className="dd">{t("dd")}</span>
            <span className="label">{t("month")}</span>
          </div>
          <div className="ev">
            <span className="t">{t(`items.${e.key}.title`)}</span>
            <span className="m">
              <span className="ph">{t("time")}</span> ·{" "}
              {"atHall" in e ? t("hall") : <span className="ph">{t("place")}</span>}
            </span>
          </div>
          {variant === "home" ? (
            <span className="tlink">{t("details")}</span>
          ) : (
            <span className={`tag ${e.tone}`}>{t(`items.${e.key}.tag`)}</span>
          )}
        </Link>
      ))}
    </div>
  );
}
