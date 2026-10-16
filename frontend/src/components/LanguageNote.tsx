import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { getDirection, routing } from "@/i18n/routing";

// Text direction of a language the API returned ("auto" if it is not one we know).
export function directionOf(language: string): "rtl" | "ltr" | "auto" {
  return hasLocale(routing.locales, language) ? getDirection(language) : "auto";
}

// "Available in English only" note, shown when an item came back in another
// language than the page's. Renders nothing when the languages match.
export async function LanguageNote({
  language,
  locale,
  className = "",
}: {
  language: string;
  locale: string;
  className?: string;
}) {
  if (language === locale) return null;
  const t = await getTranslations("News");
  return (
    <p role="note" className={`text-sm text-ink/70 ${className}`}>
      {hasLocale(routing.locales, language)
        ? t("onlyIn", { language: t(`languages.${language}`) })
        : t("onlyInOther")}
    </p>
  );
}
