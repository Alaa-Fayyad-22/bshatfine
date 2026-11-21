import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { getDirection, routing } from "@/i18n/routing";

// Text direction of a language the API returned ("auto" if it is not one we know).
export function directionOf(language: string): "rtl" | "ltr" | "auto" {
  return hasLocale(routing.locales, language) ? getDirection(language) : "auto";
}

// "Available in English only" note, shown when an item came back in another
// language than the page's. Renders nothing when the languages match.
// `of` picks the wording: a news article, or an entry (history, project...).
export async function LanguageNote({
  language,
  locale,
  of = "News",
}: {
  language: string;
  locale: string;
  of?: "News" | "Entries";
}) {
  if (language === locale) return null;
  const t = await getTranslations(of);
  return (
    <p role="note" className="lead" style={{ fontSize: 14 }}>
      {hasLocale(routing.locales, language)
        ? t("onlyIn", { language: t(`languages.${language}`) })
        : t("onlyInOther")}
    </p>
  );
}
