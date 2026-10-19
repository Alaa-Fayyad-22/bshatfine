import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Preparing } from "@/components/Preparing";
import { routing } from "@/i18n/routing";
import { getSiteSettings } from "@/lib/api";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Nav" });
  return { title: `${t("contact")} | ${t("brand")}` };
}

export default async function Page({ params }: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const tn = await getTranslations("Nav");
  const t = await getTranslations("Contact");

  return (
    <div className="section-y">
      <div className="page-container">
        <h1 className="text-4xl font-bold md:text-5xl">{tn("contact")}</h1>
        <Suspense fallback={<p role="status" className="mt-8 text-ink/70">{t("loading")}</p>}>
          <Details locale={locale} />
        </Suspense>
      </div>
    </div>
  );
}

// "tel:" links want digits and a leading +, without spaces or punctuation.
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

const link =
  "inline-flex min-h-11 items-center font-medium text-cedar underline underline-offset-4 hover:text-ink";

async function Details({ locale }: { locale: string }) {
  const t = await getTranslations("Contact");
  const s = await getSiteSettings(locale);

  if (s === null) {
    return (
      <p role="status" className="mt-8 max-w-prose text-ink/80">
        {t("error")}
      </p>
    );
  }

  const phones = [
    { label: t("phone"), value: s.phone },
    { label: t("secondaryPhone"), value: s.secondaryPhone },
  ].filter((p): p is { label: string; value: string } => !!p.value);
  const social = [
    { label: t("facebook"), href: s.facebookUrl },
    { label: t("instagram"), href: s.instagramUrl },
  ].filter((p): p is { label: string; href: string } => !!p.href);

  const empty =
    phones.length === 0 && !s.email && !s.address && !s.openingHours && !s.mapUrl && social.length === 0;
  if (empty) return <Preparing className="mt-8 md:mt-12" />;

  const row = (label: string, children: React.ReactNode) => (
    <div key={label} className="border-t border-hairline py-5">
      <dt className="text-sm font-semibold text-ink/70">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );

  return (
    <>
      <p className="mt-4 max-w-prose text-ink/80">{t("intro")}</p>
      <dl className="mt-8 grid max-w-3xl gap-x-12 border-b border-hairline md:mt-12 md:grid-cols-2">
        {phones.map((p) =>
          row(
            p.label,
            <a href={telHref(p.value)} dir="ltr" className={`${link} [unicode-bidi:isolate]`}>
              {p.value}
            </a>,
          ),
        )}
        {s.email &&
          row(
            t("email"),
            <a href={`mailto:${s.email}`} dir="ltr" className={`${link} break-all`}>
              {s.email}
            </a>,
          )}
        {s.address && row(t("address"), <span className="whitespace-pre-line">{s.address}</span>)}
        {s.openingHours &&
          row(t("hours"), <span className="whitespace-pre-line">{s.openingHours}</span>)}
      </dl>

      {(s.mapUrl || social.length > 0) && (
        <div className="mt-8 flex max-w-3xl flex-wrap items-center gap-x-8 gap-y-3">
          {s.mapUrl && (
            <a
              href={s.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-control border border-cedar px-5 font-semibold text-cedar hover:bg-cedar hover:text-ivory"
            >
              {t("map")}
              <span className="sr-only"> {t("newTab")}</span>
            </a>
          )}
          {social.length > 0 && (
            <nav aria-label={t("social")}>
              <ul className="flex flex-wrap gap-x-6">
                {social.map((item) => (
                  <li key={item.label}>
                    <a href={item.href} target="_blank" rel="noopener noreferrer" className={link}>
                      {item.label}
                      <span className="sr-only"> {t("newTab")}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      )}
    </>
  );
}
