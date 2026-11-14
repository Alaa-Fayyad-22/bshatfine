import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { HeroImage } from "./HeroImage";

export type Crumb = { label: string; href?: string };

// The photo band every public page starts with (the header lies on top of it).
// `inner` is the shorter version used by every page except the home page, with
// a "Home / ..." trail above the title.
export function Hero({
  image,
  alt,
  inner = true,
  crumbs,
  kicker,
  title,
  titleClassName,
  text,
  action,
  titleLang,
  titleDir,
}: {
  image: string;
  alt: string;
  inner?: boolean;
  crumbs?: readonly Crumb[];
  kicker?: ReactNode;
  title: ReactNode;
  titleClassName?: string;
  text?: ReactNode;
  action?: ReactNode;
  titleLang?: string;
  titleDir?: "rtl" | "ltr" | "auto";
}) {
  const t = useTranslations("Nav");

  return (
    <section className={inner ? "hero inner" : "hero"}>
      <HeroImage src={image} alt={alt} />
      <div className="shade" />
      <div className="htext">
        <div className="wrap">
          <div>
            {crumbs && (
              <div className="crumb">
                <Link href="/">{t("home")}</Link>
                {crumbs.map((c) => (
                  <span key={c.label}>
                    {" / "}
                    {c.href ? <Link href={c.href}>{c.label}</Link> : c.label}
                  </span>
                ))}
              </div>
            )}
            {kicker && <span className="k">{kicker}</span>}
            <h1 className={titleClassName} lang={titleLang} dir={titleDir}>
              {title}
            </h1>
            {text && <p>{text}</p>}
          </div>
          {action}
        </div>
      </div>
    </section>
  );
}
