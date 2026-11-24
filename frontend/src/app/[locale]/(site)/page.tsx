import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EventRows } from "@/components/site/EventRows";
import { Hero } from "@/components/site/Hero";
import { Notices } from "@/components/site/Notices";
import { CARD_SIZES, Photo, photoSrc, type PhotoName } from "@/components/site/Photo";
import { HOME_NOTICES } from "@/config/notices";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { telHref } from "@/lib/site-meta";
import { getSettings } from "@/lib/site-settings";

// The quick-access icons, as drawn in the design.
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#4F5A24"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const phoneIcon = (
  <Icon>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />
  </Icon>
);

const RAIL: ReadonlyArray<{ key: "gate" | "sunset" | "street" | "festival"; href: string }> = [
  { key: "gate", href: "/discover" },
  { key: "sunset", href: "/discover" },
  { key: "street", href: "/discover" },
  { key: "festival", href: "/events" },
];

const SERVICE_CARDS: ReadonlyArray<{
  key: "services" | "council" | "projects";
  photo: PhotoName;
  href: string;
}> = [
  { key: "services", photo: "street", href: "/services" },
  { key: "council", photo: "council", href: "/municipality" },
  { key: "projects", photo: "golden", href: "/municipality#projects" },
];

const WALL = ["sunset", "gate", "festival", "street", "aerial", "golden"] as const;

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Home");
  const tm = await getTranslations("Mayor");

  return (
    <>
      <Hero
        inner={false}
        image={photoSrc("aerial")}
        alt={t("hero.alt")}
        kicker={t("hero.kicker")}
        title={t("hero.title")}
        text={t("hero.text")}
        action={
          <Link className="tlink" href="/discover">
            {t("hero.cta")}
          </Link>
        }
      />

      <nav className="quick" aria-label={t("quick.label")}>
        <div className="wrap">
          <Link href="/services">
            <Icon>
              <path d="M7 3h7l5 5v13H7z" />
              <path d="M14 3v5h5" />
            </Icon>
            {t("quick.forms")}
          </Link>
          <Link href="/report">
            <Icon>
              <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
              <circle cx="12" cy="10" r="2.5" />
            </Icon>
            {t("quick.report")}
          </Link>
          <Link href="/notices">
            <Icon>
              <path d="M4 9v6h3l6 4V5L7 9z" />
              <path d="M17 9a4 4 0 0 1 0 6" />
            </Icon>
            {t("quick.notices")}
          </Link>
          <Link href="/events">
            <Icon>
              <rect x="3" y="5" width="18" height="16" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </Icon>
            {t("quick.events")}
          </Link>
          {/* The number comes from the saved contact details (live). */}
          <Suspense fallback={<Emergency label={t("quick.emergency")} placeholder={t("quick.emergencyPlaceholder")} />}>
            <SavedEmergency
              locale={locale}
              label={t("quick.emergency")}
              placeholder={t("quick.emergencyPlaceholder")}
            />
          </Suspense>
        </div>
      </nav>

      <section className="section">
        <div className="wrap split" style={{ gap: 56 }}>
          <div
            style={{ flex: "1 1 300px", maxWidth: 360, display: "flex", flexDirection: "column", gap: 22 }}
            data-reveal
          >
            <div>
              <span className="kicker">{t("discover.kicker")}</span>
              <h2 className="title">{t("discover.title")}</h2>
            </div>
            <p className="lead">{t("discover.lead")}</p>
            <Link className="tlink" href="/discover">
              {t("discover.all")}
            </Link>
          </div>
          <div style={{ flex: "999 1 640px", minWidth: 0 }} className="rail">
            {RAIL.map((card) => (
              <Link key={card.key} className="pcard" href={card.href} data-reveal>
                <Photo name={card.key} alt={t(`discover.cards.${card.key}.alt`)} sizes="280px" />
                <span className="label">{t(`discover.cards.${card.key}.label`)}</span>
                <span className="t">{t(`discover.cards.${card.key}.title`)}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="statement">
        <Photo name="golden" alt={t("statement.alt")} fill sizes="100vw" />
        <div className="veil" />
        <div className="in">
          <span className="label" style={{ color: "#E9E2D6", letterSpacing: 4 }} data-reveal>
            {locale === "ar" ? (
              <>
                بشتفين · <span lang="en">Bshatfine</span>
              </>
            ) : (
              <>
                Bshatfine · <span lang="ar">بشتفين</span>
              </>
            )}
          </span>
          <p data-reveal>{t("statement.quote")}</p>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="head-row" data-reveal>
            <div>
              <span className="kicker">{t("service.kicker")}</span>
              <h2 className="title">{t("service.title")}</h2>
            </div>
            <p className="lead" style={{ maxWidth: 460 }}>
              {t("service.lead")}
            </p>
          </div>
          <div className="grid g3">
            {SERVICE_CARDS.map((card) => (
              <Link key={card.key} className="pcard" href={card.href} data-reveal>
                <Photo
                  name={card.photo}
                  alt={t(`service.cards.${card.key}.alt`)}
                  sizes={CARD_SIZES}
                  style={{ height: 380 }}
                />
                <span className="t">{t(`service.cards.${card.key}.title`)}</span>
                <span className="d">{t(`service.cards.${card.key}.text`)}</span>
                <span className="tlink">{t(`service.cards.${card.key}.link`)}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="wrap split">
          <div className="main">
            <div style={{ marginBottom: 36 }} data-reveal>
              <span className="kicker">{t("coming.kicker")}</span>
              <h2 className="title">{t("coming.title")}</h2>
            </div>
            <EventRows locale={locale} allLabel={t("coming.all")} />
          </div>
          <Notices locale={locale} count={HOME_NOTICES} showAll />
        </div>
      </section>

      <section className="band">
        <div className="wrap split" style={{ padding: "110px 40px", alignItems: "center" }}>
          <Photo
            name="council"
            alt={t("mayor.alt")}
            sizes="(max-width: 700px) 100vw, 50vw"
            style={{ flex: "1 1 520px", minWidth: 0, height: 460, objectFit: "cover" }}
          />
          <div
            style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: 26 }}
            data-reveal
          >
            <span className="label ph">{tm("label")}</span>
            <p className="serif" style={{ margin: 0, fontStyle: "italic", fontSize: 36, lineHeight: 1.3 }}>
              {t("mayor.quote")}
            </p>
            <div>
              <div style={{ fontWeight: 500 }}>{tm("name")}</div>
              <div className="label" style={{ color: "var(--muted)" }}>
                {tm("role")}
              </div>
            </div>
            <Link className="tlink" href="/municipality">
              {t("mayor.link")}
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="head-row" data-reveal>
            <div>
              <span className="kicker">{t("wall.kicker")}</span>
              {/* A Latin hashtag: kept left-to-right so the # stays in front in Arabic. */}
              <h2 className="title">
                <bdi dir="ltr">{t("wall.title")}</bdi>
              </h2>
            </div>
            <div style={{ display: "flex", gap: 28 }}>
              <Suspense
                fallback={
                  <Social
                    instagram={{ label: t("wall.instagram") }}
                    facebook={{ label: t("wall.facebook") }}
                  />
                }
              >
                <SavedSocial
                  locale={locale}
                  instagram={t("wall.instagram")}
                  facebook={t("wall.facebook")}
                />
              </Suspense>
            </div>
          </div>
          <div className="wall" data-reveal>
            {WALL.map((name) => (
              <Photo
                key={name}
                name={name}
                alt={t(`wall.alts.${name}`)}
                sizes="(max-width: 700px) 50vw, 220px"
              />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

// Last item of the quick bar: "Emergency: <number>" calling the municipality's
// phone, or the design's placeholder (linking to Contact) while none is saved.
function Emergency({
  label,
  placeholder,
  phone,
}: {
  label: string;
  placeholder: string;
  phone?: string | null;
}) {
  // Icon, label and number are three flex items of the link, as in the design.
  return phone ? (
    <a href={telHref(phone)}>
      {phoneIcon}
      {label}
      <span dir="ltr">{phone}</span>
    </a>
  ) : (
    <Link href="/contact">
      {phoneIcon}
      {label}
      <span className="ph">{placeholder}</span>
    </Link>
  );
}

async function SavedEmergency({
  locale,
  label,
  placeholder,
}: {
  locale: string;
  label: string;
  placeholder: string;
}) {
  const s = await getSettings(locale);
  return <Emergency label={label} placeholder={placeholder} phone={s?.phone} />;
}

type SocialLink = { label: string; href?: string | null };

// Instagram and Facebook: the municipality's own pages once saved in the
// contact details, otherwise the design's generic links.
function Social({ instagram, facebook }: { instagram: SocialLink; facebook: SocialLink }) {
  const style = { textDecoration: "none", color: "var(--pine)" };
  return (
    <>
      <a
        className="label"
        href={instagram.href || "https://www.instagram.com/bchetfine/"}
        target="_blank"
        rel="noopener noreferrer"
        style={style}
      >
        {instagram.label}
      </a>
      <a
        className="label"
        href={facebook.href || "https://www.facebook.com/bchetfinemunicipality/"}
        target="_blank"
        rel="noopener noreferrer"
        style={style}
      >
        {facebook.label}
      </a>
    </>
  );
}

async function SavedSocial({
  locale,
  instagram,
  facebook,
}: {
  locale: string;
  instagram: string;
  facebook: string;
}) {
  const s = await getSettings(locale);
  return (
    <Social
      instagram={{ label: instagram, href: s?.instagramUrl }}
      facebook={{ label: facebook, href: s?.facebookUrl }}
    />
  );
}
