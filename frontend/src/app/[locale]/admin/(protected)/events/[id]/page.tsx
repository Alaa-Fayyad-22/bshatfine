import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { EventForm } from "@/components/admin/EventForm";
import { routing } from "@/i18n/routing";

// Cache Components needs at least one param to prerender the route shell. The
// event itself is loaded in the browser, so no real id is needed here.
// Behind AdminGuard (renders nothing until the session is confirmed).
export const instant = false;

export function generateStaticParams() {
  return [{ id: "_" }];
}

export default async function EditEventPage({ params }: PageProps<"/[locale]/admin/events/[id]">) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <EventForm key={id} id={id} />;
}
