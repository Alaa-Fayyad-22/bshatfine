import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { PagesPanel } from "@/components/admin/PagesPanel";
import { routing } from "@/i18n/routing";

// Behind AdminGuard (renders nothing until the session is confirmed).
export const instant = false;

export default async function AdminPagesPage({ params }: PageProps<"/[locale]/admin/pages">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <PagesPanel />;
}
