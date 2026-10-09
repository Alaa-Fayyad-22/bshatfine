import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function Hero() {
  const t = useTranslations("Home.Hero");
  const tn = useTranslations("Nav");

  return (
    // -mt-18 pulls the hero up under the (transparent) sticky header.
    // 2.75rem = height of the alert bar above.
    <section
      id="hero"
      className="on-cedar relative -mt-18 flex min-h-[max(34rem,calc(100svh-2.75rem))] items-end overflow-hidden bg-cedar text-ivory"
    >
      <div className="absolute inset-0">
        {/* PLACEHOLDER photo: replace public/images/hero-placeholder.jpg */}
        <Image
          src="/images/hero-placeholder.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>
      {/* The only gradient on the site: cedar tint so the title stays readable */}
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-t from-cedar/90 via-cedar/60 to-cedar/40"
      />

      <div className="page-container relative pt-36 pb-16 md:pb-24">
        <h1 className="max-w-3xl text-3xl leading-tight font-bold sm:text-4xl lg:text-5xl">
          {tn("brand")}
        </h1>
        <p className="mt-5 max-w-xl text-lg text-ivory/90 md:text-xl">
          {t("subtitle")}
        </p>
        <Link
          href="/services"
          className="mt-8 inline-flex min-h-12 items-center rounded-control bg-gold px-7 text-base font-semibold text-ink hover:bg-ivory"
        >
          {t("cta")}
        </Link>
      </div>
    </section>
  );
}
