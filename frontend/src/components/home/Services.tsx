import { useTranslations } from "next-intl";
import { ArrowIcon } from "@/components/ArrowIcon";
import { Link } from "@/i18n/navigation";

const keys = ["permits", "certificates", "fees", "requests"] as const;

// A typographic list, not cards: number, title, one line, arrow. Rows are
// full-bleed so the hairlines and the hover tint run edge to edge.
export function Services() {
  const t = useTranslations("Home.Services");

  return (
    <section
      aria-labelledby="services-title"
      className="on-cedar section-y bg-cedar text-ivory"
    >
      <div className="page-container">
        <h2 id="services-title" className="text-3xl font-bold md:text-4xl">
          {t("title")}
        </h2>
      </div>

      <ul className="mt-10 border-t border-ivory/20 md:mt-14">
        {keys.map((key) => (
          <li key={key}>
            <Link
              href="/services"
              className="group relative block border-b border-ivory/20"
            >
              {/* Hover tint: a layer whose opacity animates (not the colour) */}
              <span
                aria-hidden
                className="absolute inset-0 bg-ivory/[0.06] opacity-0 transition-opacity duration-300 ease-soft group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
              />
              <span className="page-container relative grid grid-cols-[auto_1fr_auto] items-center gap-x-5 py-7 md:gap-x-10 md:py-10">
                <span className="w-8 text-lg font-medium text-gold md:w-14 md:text-xl">
                  {t(`items.${key}.number`)}
                </span>
                <span>
                  <span className="block text-xl font-semibold md:text-3xl">
                    {t(`items.${key}.title`)}
                  </span>
                  <span className="mt-1 block text-base text-ivory/75 md:text-md">
                    {t(`items.${key}.text`)}
                  </span>
                </span>
                {/* Nudges toward the reading direction (rtl: flips it) */}
                <ArrowIcon className="transition-[translate] duration-300 ease-soft group-hover:translate-x-2 group-focus-visible:translate-x-2 rtl:group-hover:-translate-x-2 rtl:group-focus-visible:-translate-x-2 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 motion-reduce:rtl:group-hover:translate-x-0" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
