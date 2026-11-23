import { SiteImage } from "@/components/SiteImage";
import { coverUrl } from "@/lib/cover";

// The picture shown for an article or page that has no cover of its own.
export const DEFAULT_COVER = "/images/festival.jpg";

// Fills its (relatively positioned) parent. Shows the cover with the title as
// alt text, or the default photo (decorative, so no alt) without one. Used by
// the admin forms; the public pages place their images directly.
export function NewsCover({
  coverImageUrl,
  title,
  sizes,
  preload = false,
}: {
  coverImageUrl: string | null;
  title: string;
  sizes: string;
  preload?: boolean;
}) {
  const src = coverUrl(coverImageUrl);
  return (
    <SiteImage
      src={src ?? DEFAULT_COVER}
      alt={src ? title : ""}
      fill
      sizes={sizes}
      preload={preload}
      className="object-cover"
    />
  );
}
