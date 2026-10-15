import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { AdminOnly } from "@/components/admin/AdminOnly";
import { AuditPanel } from "@/components/admin/AuditPanel";
import { routing } from "@/i18n/routing";

// Behind AdminGuard (renders nothing until the session is confirmed).
export const instant = false;

export default async function AdminAuditPage({ params }: PageProps<"/[locale]/admin/audit">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <AdminOnly>
      <AuditPanel />
    </AdminOnly>
  );
}
