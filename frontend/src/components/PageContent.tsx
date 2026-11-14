import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { directionOf, LanguageNote } from "@/components/LanguageNote";
import { Markdown } from "@/components/Markdown";
import { Preparing } from "@/components/Preparing";
import { Hero } from "@/components/site/Hero";
import { photoSrc, type PhotoName } from "@/components/site/Photo";
import { getPage, type PageDto } from "@/lib/api";

export type EditablePageKey = "tourism" | "achievements";

const PHOTO: Record<EditablePageKey, PhotoName> = {
  tourism: "sunset",
  achievements: "golden",
};

// A public editable page (tourism, achievements): the inner hero, then the
// page's text in the same style as the village story on Discover. The hero
// renders at once; the text is fetched live behind <Suspense>.
export async function PageContent({
  pageKey,
  locale,
}: {
  pageKey: EditablePageKey;
  locale: string;
}) {
  const t = await getTranslations("Pages");
  const tn = await getTranslations("Nav");

  return (
    <>
      <Hero
        image={photoSrc(PHOTO[pageKey])}
        alt={t(`${pageKey}.alt`)}
        crumbs={[{ label: tn(pageKey) }]}
        kicker={t(`${pageKey}.kicker`)}
        title={t(`${pageKey}.title`)}
      />
      <section className="section">
        <div className="wrap">
          <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 22 }}>
            <Suspense
              fallback={
                <p role="status" className="lead">
                  {t("loading")}
                </p>
              }
            >
              <Loaded pageKey={pageKey} locale={locale} />
            </Suspense>
          </div>
        </div>
      </section>
    </>
  );
}

async function Loaded({ pageKey, locale }: { pageKey: EditablePageKey; locale: string }) {
  const t = await getTranslations("Pages");

  let page: PageDto | null;
  try {
    page = await getPage(pageKey, locale);
  } catch {
    return (
      <p role="status" className="lead">
        {t("error")}
      </p>
    );
  }
  // Missing or unpublished.
  if (page === null) return <Preparing />;

  return (
    <>
      <LanguageNote language={page.language} locale={locale} />
      <div
        lang={page.language}
        dir={directionOf(page.language)}
        style={{ display: "flex", flexDirection: "column", gap: 22 }}
      >
        <p className="serif" style={{ margin: 0, fontSize: 34, lineHeight: 1.35 }}>
          {page.title}
        </p>
        <Markdown site>{page.body}</Markdown>
      </div>
    </>
  );
}
