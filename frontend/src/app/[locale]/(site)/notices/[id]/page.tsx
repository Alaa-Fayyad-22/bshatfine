import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { directionOf, LanguageNote } from "@/components/LanguageNote";
import { Hero } from "@/components/site/Hero";
import { noticeTime } from "@/components/site/NoticeCard";
import { photoSrc } from "@/components/site/Photo";
import { isNoticeCategory, isNoticePriority, PRIORITY_CLASS } from "@/config/notices";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getNotice, type NoticeDto } from "@/lib/api";

// One notice on its own page. Built like the event page: Cache Components needs
// one param to prerender the route shell, and this placeholder only produces it.
const SHELL_ID = "_";

export function generateStaticParams() {
  return [{ id: SHELL_ID }];
}

// Blocks on purpose: an unknown or unpublished id must answer with a real 404
// (the proxy checks it live first, see src/proxy.ts).
export const instant = false;

// One request per render, shared by generateMetadata and the page.
// undefined = the API could not be reached.
const loadNotice = cache(async (locale: string, id: string): Promise<NoticeDto | null | undefined> => {
  if (id === SHELL_ID) return null;
  try {
    return await getNotice(locale, id);
  } catch {
    return undefined;
  }
});

// The first line of the text, shortened, as the page description.
function describe(body: string): string | undefined {
  const line = body.split(/\r?\n/).find((l) => l.trim() !== "")?.trim();
  if (!line) return undefined;
  const chars = Array.from(line);
  return chars.length > 200 ? `${chars.slice(0, 199).join("")}…` : line;
}

export async function generateMetadata({ params }: PageProps<"/[locale]/notices/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Meta" });
  const notice = await loadNotice(locale, id);
  if (!notice) return { title: t("pages.notices") };
  const title = t("pages.notice", { title: notice.title });
  return { title, description: describe(notice.body), openGraph: { title } };
}

// The hero title shrinks in two steps for long titles, so it never overflows.
function titleSize(title: string): string | undefined {
  const length = Array.from(title).length;
  if (length > 80) return "xlong";
  if (length > 28) return "long";
  return undefined;
}

const row = { display: "flex", flexWrap: "wrap", gap: "4px 14px", alignItems: "baseline" } as const;
const term = { color: "var(--muted)", minWidth: 110 } as const;
const value = { margin: 0, fontSize: 18, overflowWrap: "anywhere" } as const;

export default async function Page({ params }: PageProps<"/[locale]/notices/[id]">) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Notices");
  const tn = await getTranslations("Nav");
  const notice = await loadNotice(locale, id);
  if (notice === null) notFound();

  const column = { maxWidth: 760, display: "flex", flexDirection: "column", gap: 22 } as const;
  const crumbs = [{ label: tn("notices"), href: "/notices" }];

  // API down: a calm message under a neutral hero, never a broken page.
  if (notice === undefined) {
    return (
      <>
        <Hero image={photoSrc("aerial")} alt={t("hero.alt")} crumbs={crumbs} title={t("errorTitle")} />
        <section className="section">
          <div className="wrap">
            <div style={column}>
              <p role="status" className="lead">
                {t("noticeError")}
              </p>
            </div>
          </div>
        </section>
      </>
    );
  }

  const dir = directionOf(notice.language);
  const category = isNoticeCategory(notice.category) ? notice.category : null;
  const priority = isNoticePriority(notice.priority) ? notice.priority : null;

  return (
    <>
      <Hero
        image={photoSrc("aerial")}
        alt={t("hero.alt")}
        crumbs={crumbs}
        kicker={category ? t(`categories.${category}`) : undefined}
        title={notice.title}
        titleClassName={titleSize(notice.title)}
        titleLang={notice.language}
        titleDir={dir}
      />

      <section className="section">
        <div className="wrap">
          <article style={column}>
            {notice.isExpired && (
              <p
                role="note"
                className="label"
                style={{
                  margin: 0,
                  padding: "14px 18px",
                  borderInlineStart: "3px solid var(--clay)",
                  background: "var(--stone)",
                  color: "var(--ink)",
                  fontSize: 14,
                }}
              >
                {t("expired")}
              </p>
            )}
            <LanguageNote language={notice.language} locale={locale} of="Notices" />

            <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {priority && (
                <div style={row}>
                  <dt className="label" style={term}>
                    {t("meta.priority")}
                  </dt>
                  <dd style={{ margin: 0 }}>
                    <span className={PRIORITY_CLASS[priority]}>{t(`priorities.${priority}`)}</span>
                  </dd>
                </div>
              )}
              {category && (
                <div style={row}>
                  <dt className="label" style={term}>
                    {t("meta.category")}
                  </dt>
                  <dd style={value}>{t(`categories.${category}`)}</dd>
                </div>
              )}
              {notice.area.trim() !== "" && (
                <div style={row}>
                  <dt className="label" style={term}>
                    {t("meta.area")}
                  </dt>
                  <dd lang={notice.language} dir={dir} style={value}>
                    {notice.area}
                  </dd>
                </div>
              )}
              {notice.validFrom && (
                <div style={row}>
                  <dt className="label" style={term}>
                    {t("meta.validFrom")}
                  </dt>
                  <dd style={value}>
                    <time dateTime={notice.validFrom}>{noticeTime(locale, notice.validFrom)}</time>
                  </dd>
                </div>
              )}
              {notice.validUntil && (
                <div style={row}>
                  <dt className="label" style={term}>
                    {t("meta.validUntil")}
                  </dt>
                  <dd style={value}>
                    <time dateTime={notice.validUntil}>{noticeTime(locale, notice.validUntil)}</time>
                  </dd>
                </div>
              )}
              {notice.publishedAt && (
                <div style={row}>
                  <dt className="label" style={term}>
                    {t("meta.published")}
                  </dt>
                  <dd style={value}>
                    <time dateTime={notice.publishedAt}>{noticeTime(locale, notice.publishedAt)}</time>
                  </dd>
                </div>
              )}
            </dl>
            {(notice.validFrom || notice.validUntil || notice.publishedAt) && (
              <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>{t("timeNote")}</p>
            )}

            {/* Plain text only: React escapes it, and line breaks are kept. */}
            {notice.body.trim() !== "" && (
              <p
                lang={notice.language}
                dir={dir}
                className="lead"
                style={{ whiteSpace: "pre-line", color: "var(--ink)", overflowWrap: "anywhere" }}
              >
                {notice.body}
              </p>
            )}

            <Link className="tlink" href="/notices" style={{ alignSelf: "flex-start" }}>
              {t("back")}
            </Link>
          </article>
        </div>
      </section>
    </>
  );
}
