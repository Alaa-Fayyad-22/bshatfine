import type { CSSProperties } from "react";
import Image from "next/image";

// The site's own photos (public/images) with their real pixel sizes, so
// next/image can serve resized versions and reserve the right space. The
// displayed size and crop always come from the design's CSS (object-fit: cover).
const PHOTOS = {
  aerial: { src: "/images/aerial.jpg", width: 2048, height: 1151 },
  council: { src: "/images/council.jpg", width: 2048, height: 1365 },
  festival: { src: "/images/festival.jpg", width: 1152, height: 2048 },
  gate: { src: "/images/gate.jpg", width: 1365, height: 2048 },
  golden: { src: "/images/golden.jpg", width: 1638, height: 2048 },
  street: { src: "/images/street.jpg", width: 1536, height: 2048 },
  sunset: { src: "/images/sunset.jpg", width: 1985, height: 1489 },
  logoWhite: { src: "/images/logo-white.png", width: 648, height: 275 },
} as const;

export type PhotoName = keyof typeof PHOTOS;

export const photoSrc = (name: PhotoName): string => PHOTOS[name].src;

// `sizes` tells the browser how wide the image is shown, so it downloads a
// version of about that width. `fill` stretches it over its positioned parent.
export function Photo({
  name,
  alt,
  sizes,
  fill = false,
  style,
}: {
  name: PhotoName;
  alt: string;
  sizes: string;
  fill?: boolean;
  style?: CSSProperties;
}) {
  const photo = PHOTOS[name];
  return fill ? (
    <Image src={photo.src} alt={alt} fill sizes={sizes} style={style} />
  ) : (
    <Image
      src={photo.src}
      alt={alt}
      width={photo.width}
      height={photo.height}
      sizes={sizes}
      style={style}
    />
  );
}

// "Roughly a third of the page" (cards in a three-column grid), full width on phones.
export const CARD_SIZES = "(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 420px";
