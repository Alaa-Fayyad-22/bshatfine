import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { NoticeForm } from "@/components/admin/NoticeForm";
import { routing } from "@/i18n/routing";

// Cache Components needs at least one param to prerender the route shell. The
// notice itself is loaded in the browser, so no real id is needed here.
// Behind AdminGuard (renders nothing until the session is confirmed).
export const instant = false;

export function generateStaticParams() {
  return [{ id: "_" }];
}

export default async function EditNoticePage({ params }: PageProps<"/[locale]/admin/notices/[id]">) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <NoticeForm key={id} id={id} />;
}
