import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { getLocale } from "next-intl/server";
import { Photo } from "@/components/site/Photo";
import { SiteForm } from "@/components/site/SiteForm";
import { loginHref } from "@/config/navigation";
import { Link } from "@/i18n/navigation";
import { telHref } from "@/lib/site-meta";
import { getSettings } from "@/lib/site-settings";

// The dark footer of the approved design: logo and contact line, two link
// columns, the newsletter form and the legal line.
export function Footer() {
  const t = useTranslations("Footer");
  const tn = useTranslations("Nav");
  const th = useTranslations("Header");
  const tf = useTranslations("Forms");

  return (
    <footer className="dark">
      <div className="wrap">
        <div className="fcols">
          <div className="fcol" style={{ flex: "1 1 280px", maxWidth: 360 }}>
            <Photo
              name="logoWhite"
              alt={th("logoAlt")}
              sizes="208px"
              style={{ height: 88, width: "auto", alignSelf: "flex-start" }}
            />
            {/* Contact details come from the API (live), so they stream in. */}
            <Suspense fallback={<Details hall={t("hall")} />}>
              <SavedDetails hall={t("hall")} />
            </Suspense>
          </div>
          <div className="fcol" style={{ flex: "1 1 150px" }}>
            <span className="label">{t("village")}</span>
            <Link href="/discover">{tn("discover")}</Link>
            <Link href="/events">{tn("events")}</Link>
            <Link href="/news">{tn("news")}</Link>
          </div>
          <div className="fcol" style={{ flex: "1 1 150px" }}>
            <span className="label">{t("municipality")}</span>
            <Link href="/municipality">{t("council")}</Link>
            <Link href="/services">{t("servicesForms")}</Link>
            <Link href="/report">{t("report")}</Link>
            <Link href="/contact">{tn("contact")}</Link>
          </div>
          <SiteForm
            className="fcol"
            style={{ flex: "1 1 280px", maxWidth: 360 }}
            doneStyle={{ borderColor: "var(--gold)", color: "var(--gold)", padding: "12px 14px" }}
            message={tf("comingSoon")}
          >
            <span className="label">{t("newsByEmail")}</span>
            <label htmlFor="nl-email">{t("newsletterText")}</label>
            <div className="nl">
              <input id="nl-email" type="email" placeholder={t("emailPlaceholder")} required />
              <button type="submit">{t("subscribe")}</button>
            </div>
          </SiteForm>
        </div>
        <div className="legal">
          <span>{t("rights")}</span>
          {/* Phase 1 has staff login only, so it stays a discreet footer link. */}
          <span>
            <Link href={loginHref}>{tn("login")}</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}

async function SavedDetails({ hall }: { hall: string }) {
  const s = await getSettings(await getLocale());
  return (
    <Details
      hall={hall}
      address={s?.address}
      phone={s?.phone}
      email={s?.email}
      hours={s?.openingHours}
    />
  );
}

// Up to three lines: address, phone · email, opening hours. A missing value is
// simply left out (no brackets); without a saved address the first line names
// the Municipal Hall, as in the design.
function Details({
  hall,
  address,
  phone,
  email,
  hours,
}: {
  hall: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  hours?: string | null;
}) {
  return (
    <p style={{ margin: "8px 0 0", lineHeight: 1.8, whiteSpace: "pre-line" }}>
      {address || hall}
      {(phone || email) && (
        <>
          <br />
          {phone && (
            <a href={telHref(phone)} dir="ltr" style={{ unicodeBidi: "isolate" }}>
              {phone}
            </a>
          )}
          {phone && email && " · "}
          {email && (
            <a href={`mailto:${email}`} dir="ltr" style={{ overflowWrap: "anywhere" }}>
              {email}
            </a>
          )}
        </>
      )}
      {hours && (
        <>
          <br />
          {hours}
        </>
      )}
    </p>
  );
}
