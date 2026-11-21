import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { directionOf, LanguageNote } from "@/components/LanguageNote";
import { Markdown } from "@/components/Markdown";
import { Hero } from "@/components/site/Hero";
import { photoSrc } from "@/components/site/Photo";
import {
  ENTRY_RULES,
  isEntryKind,
  isProjectStatus,
  knownCategory,
  STATUS_CLASS,
  type EntryKind,
} from "@/config/entries";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { coverUrl, getEntry, type EntryDto } from "@/lib/api";
import { siteUrl } from "@/lib/site-url";

// One history entry, project, place or service on its own page. Built like the
// news article page: Cache Components needs one param to prerender the route
// shell, and this placeholder only produces that shell.
const SHELL_ID = "_";

export function generateStaticParams() {
  return [{ id: SHELL_ID }];
}

// Blocks on purpose (see Page): an unknown or unpublished id must answer with a
// real 404 (the proxy checks it live first, see src/proxy.ts).
export const instant = false;

// One request per render, shared by generateMetadata and the page.
// undefined = the API could not be reached.
const loadEntry = cache(async (locale: string, id: string): Promise<EntryDto | null | undefined> => {
  if (id === SHELL_ID) return null;
  try {
    return await getEntry(locale, id);
  } catch {
    return undefined;
  }
});

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/entries/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Meta" });
  const entry = await loadEntry(locale, id);
  if (!entry) return { title: t("title") };
  const title = t("pages.entry", { title: entry.title });
  const path = coverUrl(entry.coverImageUrl);
  const base = siteUrl();
  const cover = path && base ? new URL(path, base).toString() : null;
  return {
    title,
    description: entry.summary,
    ...(cover && {
      openGraph: { title, images: [{ url: cover, alt: entry.title }] },
      twitter: { card: "summary_large_image", title, images: [cover] },
    }),
  };
}

// The hero title shrinks in two steps for long titles, so it never overflows.
function titleSize(title: string): string | undefined {
  const length = Array.from(title).length;
  if (length > 80) return "xlong";
  if (length > 28) return "long";
  return undefined;
}

export default async function Page({ params }: PageProps<"/[locale]/entries/[id]">) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Entries");
  const tn = await getTranslations("Nav");
  const entry = await loadEntry(locale, id);
  if (entry === null) notFound();

  const column = { maxWidth: 760, display: "flex", flexDirection: "column", gap: 22 } as const;

  // API down: a calm message under a neutral hero, never a broken page.
  if (entry === undefined) {
    return (
      <>
        <Hero
          image={photoSrc("aerial")}
          alt={t("photoAlt.history")}
          crumbs={[]}
          title={t("errorTitle")}
        />
        <section className="section">
          <div className="wrap">
            <div style={column}>
              <p role="status" className="lead">
                {t("error")}
              </p>
            </div>
          </div>
        </section>
      </>
    );
  }

  const kind: EntryKind = isEntryKind(entry.kind) ? entry.kind : "history";
  const rule = ENTRY_RULES[kind];
  const cover = coverUrl(entry.coverImageUrl);
  const dir = directionOf(entry.language);
  const category = categoryOf(t, kind, entry.category);
  const status = rule.usesStatus && isProjectStatus(entry.status) ? entry.status : null;
  const year = rule.usesYear ? entry.year : null;

  return (
    <>
      <Hero
        image={cover ?? photoSrc(rule.photo)}
        alt={cover ? entry.title : t(`photoAlt.${kind}`)}
        crumbs={[{ label: tn(rule.section), href: `/${rule.section}` }]}
        kicker={t(`kinds.${kind}`)}
        title={entry.title}
        titleClassName={titleSize(entry.title)}
        titleLang={entry.language}
        titleDir={dir}
      />

      <section className="section">
        <div className="wrap">
          <article style={column}>
            <LanguageNote language={entry.language} locale={locale} of="Entries" />
            {(year !== null || category || status) && (
              <dl
                style={{
                  margin: 0,
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "10px 28px",
                }}
              >
                {year !== null && (
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <dt className="label" style={{ color: "var(--muted)" }}>
                      {t("meta.year")}
                    </dt>
                    <dd className="label" style={{ margin: 0 }}>
                      {year}
                    </dd>
                  </div>
                )}
                {category && (
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <dt className="label" style={{ color: "var(--muted)" }}>
                      {category.heading}
                    </dt>
                    <dd className="label" style={{ margin: 0, color: "var(--clay)" }}>
                      {category.value}
                    </dd>
                  </div>
                )}
                {status && (
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <dt className="label" style={{ color: "var(--muted)" }}>
                      {t("meta.status")}
                    </dt>
                    <dd style={{ margin: 0 }}>
                      <span className={`tag ${STATUS_CLASS[status]}`}>{t(`statuses.${status}`)}</span>
                    </dd>
                  </div>
                )}
              </dl>
            )}
            <div lang={entry.language} dir={dir} style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              <p className="serif" style={{ margin: 0, fontSize: 28, lineHeight: 1.4 }}>
                {entry.summary}
              </p>
              {entry.body.trim() !== "" && <Markdown site>{entry.body}</Markdown>}
            </div>
            <Link
              className="tlink"
              href={`/${rule.section}#${rule.anchor}`}
              style={{ alignSelf: "flex-start" }}
            >
              {t(`back.${rule.section}`)}
            </Link>
          </article>
        </div>
      </section>
    </>
  );
}

type T = Awaited<ReturnType<typeof getTranslations<"Entries">>>;

// The category's heading ("Area", "Type"...) and its translated value; null
// when the kind has no category or the code is unknown.
function categoryOf(t: T, kind: EntryKind, raw: string | null) {
  switch (kind) {
    case "project": {
      const c = knownCategory(kind, raw);
      return c && { heading: t("meta.category.project"), value: t(`categories.project.${c}`) };
    }
    case "place": {
      const c = knownCategory(kind, raw);
      return c && { heading: t("meta.category.place"), value: t(`categories.place.${c}`) };
    }
    case "service": {
      const c = knownCategory(kind, raw);
      return c && { heading: t("meta.category.service"), value: t(`categories.service.${c}`) };
    }
    default:
      return null;
  }
}
