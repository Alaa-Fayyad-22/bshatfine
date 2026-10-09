import Image from "next/image";
import { useTranslations } from "next-intl";

// Asymmetric: the photo is flush with the START edge of the viewport (it
// bleeds off the page; no container, no rounding), the text sits on the other
// side, pushed down and narrower. Nothing is centered.
export function About() {
  const t = useTranslations("Home.About");

  return (
    <section aria-labelledby="about-title" className="section-y bg-sand">
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-0">
        <div className="relative aspect-[4/3] overflow-hidden lg:aspect-auto lg:h-[38rem]">
          {/* PLACEHOLDER photo: replace public/images/about-placeholder.jpg */}
          <Image
            src="/images/about-placeholder.jpg"
            alt={t("imageAlt")}
            fill
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="object-cover"
          />
        </div>

        <div className="px-4 md:px-8 lg:ps-16 lg:pe-12 lg:pt-28 xl:pe-24">
          <h2 id="about-title" className="text-3xl font-bold md:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-6 max-w-md text-ink/85">{t("text")}</p>
        </div>
      </div>
    </section>
  );
}
