import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { navItems } from "@/lib/nav";
import { contact } from "@/lib/site";

export function Footer() {
  const t = useTranslations("Footer");
  const tn = useTranslations("Nav");

  return (
    <footer className="on-cedar bg-cedar text-ivory">
      <div className="page-container grid gap-10 py-14 text-base md:grid-cols-[1.2fr_1.5fr_1fr] md:gap-12">
        <div>
          <p className="text-lg font-semibold">{tn("brand")}</p>
          <p className="mt-2 max-w-xs text-ivory/75">{t("about")}</p>
        </div>

        <div>
          <h2 className="text-base font-semibold">{t("contactTitle")}</h2>
          <dl className="mt-3 grid gap-3 text-ivory/80">
            <div>
              <dt className="text-sm text-ivory/60">{t("addressLabel")}</dt>
              <dd>{t("address")}</dd>
            </div>
            <div>
              <dt className="text-sm text-ivory/60">{t("phoneLabel")}</dt>
              <dd>
                <a
                  href={contact.phoneHref}
                  dir="ltr"
                  className="inline-block underline-offset-4 hover:underline"
                >
                  {contact.phoneDisplay}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ivory/60">{t("hoursLabel")}</dt>
              <dd>{t("hours")}</dd>
            </div>
          </dl>
        </div>

        <nav aria-label={t("linksTitle")}>
          <h2 className="text-base font-semibold">{t("linksTitle")}</h2>
          <ul className="mt-3 text-ivory/80">
            {navItems
              .filter((i) => i.key !== "home")
              .map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
                  >
                    {tn(item.key)}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-ivory/15">
        <p className="page-container py-5 text-sm text-ivory/60">
          {t("rights")}
        </p>
      </div>
    </footer>
  );
}
