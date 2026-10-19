import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Preparing } from "@/components/Preparing";
import { routing } from "@/i18n/routing";
import { coverUrl, getCouncil, type CouncilMemberDto } from "@/lib/api";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/council">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Nav" });
  return { title: `${t("council")} | ${t("brand")}` };
}

export default async function Page({ params }: PageProps<"/[locale]/council">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const tn = await getTranslations("Nav");
  const t = await getTranslations("Council");

  return (
    <div className="section-y">
      <div className="page-container">
        <h1 className="text-4xl font-bold md:text-5xl">{tn("council")}</h1>
        <Suspense fallback={<p role="status" className="mt-8 text-ink/70">{t("loading")}</p>}>
          <Members locale={locale} />
        </Suspense>
      </div>
    </div>
  );
}

// First letters of the first two words ("Ali Hassan" -> "AH", "علي حسن" -> "عح").
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("");
}

async function Members({ locale }: { locale: string }) {
  const t = await getTranslations("Council");

  let members: CouncilMemberDto[];
  try {
    members = await getCouncil(locale);
  } catch {
    return (
      <p role="status" className="mt-8 max-w-prose text-ink/80">
        {t("error")}
      </p>
    );
  }
  if (members.length === 0) return <Preparing className="mt-8 md:mt-12" />;

  return (
    <>
      <p className="mt-4 max-w-prose text-ink/80">{t("intro")}</p>
      <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:mt-14 md:grid-cols-3 md:gap-x-8 lg:grid-cols-4">
        {members.map((m) => {
          const photo = coverUrl(m.photoUrl);
          return (
            <li key={m.id}>
              <div className="relative aspect-[4/5] overflow-hidden rounded-card bg-sand">
                {photo ? (
                  <Image
                    src={photo}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 16rem, (min-width: 768px) 30vw, 46vw"
                    className="object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="absolute inset-0 grid place-items-center text-4xl font-semibold text-cedar/60"
                  >
                    {initials(m.name)}
                  </span>
                )}
              </div>
              <h2 className="mt-4 text-md leading-snug font-bold md:text-lg">{m.name}</h2>
              <p className="mt-1 text-base text-ink/75">{m.position}</p>
            </li>
          );
        })}
      </ul>
    </>
  );
}
