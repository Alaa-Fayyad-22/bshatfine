import { Suspense } from "react";
import { getFormatter, getTranslations } from "next-intl/server";
import { directionOf, LanguageNote } from "@/components/LanguageNote";
import { Markdown } from "@/components/Markdown";
import { NewsCover } from "@/components/NewsCover";
import { Preparing } from "@/components/Preparing";
import { getPage, type PageDto } from "@/lib/api";

// A public editable page (history, tourism, achievements, services). The fixed
// frame renders at once; the page itself is fetched live behind <Suspense>.
export async function PageContent({ pageKey, locale }: { pageKey: string; locale: string }) {
  const tp = await getTranslations("Pages");
  return (
    <div className="section-y">
      <div className="page-container">
        <Suspense fallback={<p role="status" className="text-ink/70">{tp("loading")}</p>}>
          <Loaded pageKey={pageKey} locale={locale} />
        </Suspense>
      </div>
    </div>
  );
}

async function Loaded({ pageKey, locale }: { pageKey: string; locale: string }) {
  const tn = await getTranslations("Nav");
  const tp = await getTranslations("Pages");

  let page: PageDto | null;
  try {
    page = await getPage(pageKey, locale);
  } catch {
    return (
      <>
        <h1 className="text-4xl font-bold md:text-5xl">{tn(pageKey as "history")}</h1>
        <p role="status" className="mt-8 max-w-prose text-ink/80">
          {tp("error")}
        </p>
      </>
    );
  }

  if (page === null) {
    return (
      <>
        <h1 className="text-4xl font-bold md:text-5xl">{tn(pageKey as "history")}</h1>
        <Preparing className="mt-8 md:mt-12" />
      </>
    );
  }

  const format = await getFormatter();
  return (
    <article>
      <LanguageNote language={page.language} locale={locale} className="mb-6" />
      <div lang={page.language} dir={directionOf(page.language)}>
        <h1 className="max-w-3xl text-4xl leading-tight font-bold md:text-5xl">{page.title}</h1>
        {page.updatedAt && (
          <p className="mt-3 text-sm text-ink/70">
            {tp("updated", {
              date: format.dateTime(new Date(page.updatedAt), { dateStyle: "long" }),
            })}
          </p>
        )}
        {page.coverImageUrl && (
          <div className="relative mt-8 aspect-[3/2] max-w-3xl overflow-hidden rounded-card bg-sand md:mt-10">
            <NewsCover
              coverImageUrl={page.coverImageUrl}
              title={page.title}
              sizes="(min-width: 768px) 48rem, 100vw"
              preload
            />
          </div>
        )}
        <Markdown className="mt-8 md:mt-10">{page.body}</Markdown>
      </div>
    </article>
  );
}
