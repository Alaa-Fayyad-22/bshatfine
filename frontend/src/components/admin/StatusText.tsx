import { useTranslations } from "next-intl";
import type { NewsStatus } from "@/lib/admin-api";

const dot: Record<NewsStatus, string> = {
  Draft: "bg-alert-warn",
  Published: "bg-pine",
  Archived: "bg-ink/40",
};

// Plain-text status with a small colored dot (the text carries the meaning;
// the dot is decorative).
export function StatusText({ status }: { status: NewsStatus }) {
  const t = useTranslations("Admin.status");
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${dot[status]}`} />
      {t(status)}
    </span>
  );
}
