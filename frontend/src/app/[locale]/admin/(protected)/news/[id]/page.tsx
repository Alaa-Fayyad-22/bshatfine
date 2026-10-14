import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { NewsForm } from "@/components/admin/NewsForm";
import { routing } from "@/i18n/routing";

// Cache Components needs at least one param to prerender the route shell. The
// article itself is loaded in the browser, so no real id is needed here.
// AdminGuard renders no children until the session is confirmed, so this page is
// not part of the instant shell; opt out of instant-navigation validation.
export const instant = false;

export function generateStaticParams() {
  return [{ id: "_" }];
}

export default async function EditArticlePage({
  params,
}: PageProps<"/[locale]/admin/news/[id]">) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <NewsForm id={id} />;
}
