import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("NotFound");

  return (
    <main className="section-y">
      <div className="page-container">
        <h1 className="text-4xl font-bold md:text-5xl">{t("title")}</h1>
        <p className="mt-4 max-w-prose">{t("text")}</p>
        <Link href="/" className="mt-8 inline-block underline underline-offset-4">
          {t("backHome")}
        </Link>
      </div>
    </main>
  );
}
