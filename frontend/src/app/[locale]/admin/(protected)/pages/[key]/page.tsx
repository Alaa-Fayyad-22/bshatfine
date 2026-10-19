import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { PageForm } from "@/components/admin/PageForm";
import { routing } from "@/i18n/routing";

// Cache Components needs at least one param to prerender the route shell. The
// page itself is loaded in the browser, so no real key is needed here.
// AdminGuard renders no children until the session is confirmed, so this page is
// not part of the instant shell; opt out of instant-navigation validation.
export const instant = false;

export function generateStaticParams() {
  return [{ key: "_" }];
}

export default async function AdminEditPagePage({
  params,
}: PageProps<"/[locale]/admin/pages/[key]">) {
  const { locale, key } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <PageForm pageKey={key} />;
}
