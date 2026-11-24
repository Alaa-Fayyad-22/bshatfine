import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { directionOf } from "@/components/LanguageNote";
import { URGENT_DISMISSED_PREFIX } from "@/config/notices";
import { getUrgentNotices, type NoticeSummaryDto } from "@/lib/api";
import { formatEventWhen } from "@/lib/event-time";
import { UrgentBar, type UrgentItem } from "./UrgentBar";

// Hides the notices closed earlier in this browser session BEFORE the first
// paint (a CSS rule per closed id), so a closed notice never flashes on a full
// page load. React then removes them from the DOM (UrgentBar). Only GUID-shaped
// ids are used, so nothing from storage can inject CSS.
const HIDE_CLOSED = `(function(){try{var p=${JSON.stringify(URGENT_DISMISSED_PREFIX)},c="";for(var i=0;i<sessionStorage.length;i++){var k=sessionStorage.key(i);if(k&&k.indexOf(p)===0){var id=k.slice(p.length);if(/^[0-9a-f-]{36}$/i.test(id))c+='[data-urgent-id="'+id+'"]{display:none!important}'}}if(c){var s=document.createElement("style");s.textContent=c;document.head.appendChild(s)}}catch(e){}})();`;

// The urgent banner at the top of every public page (see (site)/layout.tsx).
// Read on the server, cached for at most about a minute (getUrgentNotices).
// Renders NOTHING when there is no urgent notice or the API cannot be reached:
// no empty box, and the page never breaks because of it.
export function UrgentNotices({ locale }: { locale: string }) {
  return (
    <Suspense fallback={null}>
      <UrgentList locale={locale} />
    </Suspense>
  );
}

async function UrgentList({ locale }: { locale: string }) {
  let notices: NoticeSummaryDto[];
  try {
    notices = await getUrgentNotices(locale);
  } catch {
    return null;
  }
  if (!Array.isArray(notices) || notices.length === 0) return null;

  const t = await getTranslations("Notices");
  const items: UrgentItem[] = notices.slice(0, 5).map((n) => ({
    id: n.id,
    title: n.title,
    language: n.language,
    dir: directionOf(n.language),
    area: n.area ?? "",
    untilIso: n.validUntil,
    until: n.validUntil
      ? t("validUntil", { date: formatEventWhen(locale, { startsAt: n.validUntil, endsAt: null, isAllDay: false }) })
      : null,
  }));
  const closeLabel = Object.fromEntries(items.map((n) => [n.id, t("closeLabel", { title: n.title })]));

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: HIDE_CLOSED }} />
      <UrgentBar
        items={items}
        label={t("urgentLabel")}
        kicker={t("urgentKicker")}
        closeLabel={closeLabel}
        closeText={t("close")}
      />
    </>
  );
}
