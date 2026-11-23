import Image, { type ImageProps } from "next/image";

// True for a photo the API serves (/api/files/...): covers, council photos.
export function isApiFile(src: ImageProps["src"]): boolean {
  return typeof src === "string" && src.startsWith("/api/files/");
}

// next/image for any picture that may come from the API. API files skip the
// optimizer (`unoptimized`): the API already serves them resized, as immutable
// WebP, and the optimizer's own server-side fetch of /api/files/... would not
// carry the proxy secret (src/proxy.ts), so the API refuses it (Vercel: 502
// OPTIMIZED_EXTERNAL_IMAGE_REQUEST_UNAUTHORIZED). Everything else (the site's
// own photos in public/images) still goes through the optimizer. Width/height
// or fill+sizes, alt and lazy loading work exactly as with next/image.
export function SiteImage({ alt, ...props }: ImageProps) {
  return <Image alt={alt} {...props} unoptimized={props.unoptimized ?? isApiFile(props.src)} />;
}
