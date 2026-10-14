import Image from "next/image";
import { coverUrl } from "@/lib/cover";

// Fills its (relatively positioned) parent. Shows the article's cover with the
// title as alt text, or the placeholder (decorative, so no alt) without one.
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
    <Image
      src={src ?? "/images/news-placeholder.jpg"}
      alt={src ? title : ""}
      fill
      sizes={sizes}
      preload={preload}
      className="object-cover"
    />
  );
}
