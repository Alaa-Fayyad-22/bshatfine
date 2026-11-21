import { notFound } from "next/navigation";
import { Suspense } from "react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContentPanel } from "@/components/admin/ContentPanel";
import { isEntryKind } from "@/config/entries";
import { routing } from "@/i18n/routing";

// Behind AdminGuard (renders nothing until the session is confirmed).
export const instant = false;

export default async function AdminContentPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/content">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Admin.content");
  // ?kind= is request-time data, so the panel sits behind <Suspense>.
  return (
    <Suspense fallback={<p role="status" className="text-ink/70">{t("loading")}</p>}>
      <Panel searchParams={searchParams} />
    </Suspense>
  );
}

async function Panel({ searchParams }: Pick<PageProps<"/[locale]/admin/content">, "searchParams">) {
  const { kind: raw } = await searchParams;
  const wanted = (Array.isArray(raw) ? raw[0] : raw)?.toLowerCase();
  // Anything unknown (or nothing) shows the first tab.
  const kind = isEntryKind(wanted) ? wanted : "history";
  return <ContentPanel key={kind} kind={kind} />;
}
