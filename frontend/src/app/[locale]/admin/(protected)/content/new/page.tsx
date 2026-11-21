import { notFound } from "next/navigation";
import { Suspense } from "react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EntryForm } from "@/components/admin/EntryForm";
import { isEntryKind } from "@/config/entries";
import { routing } from "@/i18n/routing";

// Behind AdminGuard (renders nothing until the session is confirmed).
export const instant = false;

// /admin/content/new?kind=project: a new entry of that kind.
export default async function NewEntryPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/content/new">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Admin.entryForm");
  return (
    <Suspense fallback={<p role="status" className="text-ink/70">{t("loading")}</p>}>
      <Form searchParams={searchParams} />
    </Suspense>
  );
}

async function Form({ searchParams }: Pick<PageProps<"/[locale]/admin/content/new">, "searchParams">) {
  const { kind: raw } = await searchParams;
  const kind = (Array.isArray(raw) ? raw[0] : raw)?.toLowerCase();
  if (!isEntryKind(kind)) notFound();
  return <EntryForm key={kind} kind={kind} />;
}
