import { useTranslations } from "next-intl";

// Calm "this content is being prepared" notice: for a page that is missing or
// unpublished, an empty contact page, an empty council. Not an error.
export function Preparing({ className = "" }: { className?: string }) {
  const t = useTranslations("Pages");
  return (
    <div role="status" className={`max-w-prose rounded-card bg-sand px-6 py-8 md:px-10 md:py-12 ${className}`}>
      <span aria-hidden className="block h-0.5 w-10 bg-gold" />
      <p className="mt-5 text-lg font-bold md:text-xl">{t("preparingTitle")}</p>
      <p className="mt-2 text-ink/80">{t("preparingText")}</p>
    </div>
  );
}
