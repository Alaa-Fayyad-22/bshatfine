import { useTranslations } from "next-intl";
import { Hero } from "@/components/site/Hero";
import { photoSrc } from "@/components/site/Photo";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("NotFound");

  return (
    <Hero
      image={photoSrc("aerial")}
      alt={t("imageAlt")}
      kicker={t("kicker")}
      title={t("title")}
      text={t("text")}
      action={
        <Link className="tlink" href="/">
          {t("backHome")}
        </Link>
      }
    />
  );
}
