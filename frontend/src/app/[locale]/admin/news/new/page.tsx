import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { NewsForm } from "@/components/admin/NewsForm";
import { routing } from "@/i18n/routing";

export default async function NewArticlePage({ params }: PageProps<"/[locale]/admin/news/new">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <NewsForm />;
}
