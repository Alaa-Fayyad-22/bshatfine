import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { loginHref, visibleNavItems } from "@/config/navigation";
import { getSiteSettings } from "@/lib/api";

export function Footer() {
  const t = useTranslations("Footer");
  const tn = useTranslations("Nav");

  return (
    <footer className="on-cedar bg-cedar text-ivory">
      <div className="page-container grid gap-10 py-14 text-base md:grid-cols-[1.2fr_1.5fr_1fr] md:gap-12">
        <div>
          <p className="text-lg font-semibold">{tn("brand")}</p>
          <p className="mt-2 max-w-xs text-ivory/75">{t("about")}</p>
        </div>

        {/* Contact details come from the API (live), so they stream in. */}
        <Suspense fallback={<div />}>
          <FooterContact />
        </Suspense>

        <nav aria-label={t("linksTitle")}>
          <h2 className="text-base font-semibold">{t("linksTitle")}</h2>
          <ul className="mt-3 text-ivory/80">
            {visibleNavItems
              .filter((i) => i.key !== "home")
              .map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="inline-flex min-h-11 min-w-11 items-center underline-offset-4 hover:underline"
                  >
                    {tn(item.key)}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-ivory/15">
        <div className="page-container flex flex-wrap items-center justify-between gap-x-6 py-2 text-sm text-ivory/60">
          <p className="py-3">{t("rights")}</p>
          {/* Phase 1 has staff login only, so it stays a discreet footer link.
              In Phase 2 (citizen accounts) it moves to the header. */}
          <Link
            href={loginHref}
            className="inline-flex min-h-11 items-center underline-offset-4 hover:text-ivory hover:underline"
          >
            {tn("login")}
          </Link>
        </div>
      </div>
    </footer>
  );
}

const linkClass =
  "inline-flex min-h-11 items-center underline-offset-4 hover:text-ivory hover:underline";

// "tel:" links want digits and a leading +, without spaces or punctuation.
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

// The saved contact details; every empty field is hidden, and the whole column
// is left out when nothing is saved (or the API cannot be reached).
async function FooterContact() {
  const t = await getTranslations("Footer");
  const s = await getSiteSettings(await getLocale());
  if (!s) return null;

  const phones = [s.phone, s.secondaryPhone].filter((p): p is string => !!p);
  const social = [
    { label: t("facebook"), href: s.facebookUrl },
    { label: t("instagram"), href: s.instagramUrl },
  ].filter((p): p is { label: string; href: string } => !!p.href);
  if (phones.length === 0 && !s.email && !s.address && !s.openingHours && social.length === 0) {
    return null;
  }

  const row = (label: string, children: React.ReactNode) => (
    <div>
      <dt className="text-sm text-ivory/60">{label}</dt>
      <dd>{children}</dd>
    </div>
  );

  return (
    <div>
      <h2 className="text-base font-semibold">{t("contactTitle")}</h2>
      <dl className="mt-3 grid gap-3 text-ivory/80">
        {s.address && row(t("addressLabel"), <span className="whitespace-pre-line">{s.address}</span>)}
        {phones.length > 0 &&
          row(
            t("phoneLabel"),
            <ul>
              {phones.map((p) => (
                <li key={p}>
                  <a href={telHref(p)} dir="ltr" className={`${linkClass} [unicode-bidi:isolate]`}>
                    {p}
                  </a>
                </li>
              ))}
            </ul>,
          )}
        {s.email &&
          row(
            t("emailLabel"),
            <a href={`mailto:${s.email}`} dir="ltr" className={`${linkClass} break-all`}>
              {s.email}
            </a>,
          )}
        {s.openingHours && row(t("hoursLabel"), <span className="whitespace-pre-line">{s.openingHours}</span>)}
        {social.length > 0 &&
          row(
            t("followUs"),
            <ul className="flex flex-wrap gap-x-5">
              {social.map((item) => (
                <li key={item.label}>
                  <a href={item.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    {item.label}
                    <span className="sr-only"> {t("newTab")}</span>
                  </a>
                </li>
              ))}
            </ul>,
          )}
      </dl>
    </div>
  );
}
