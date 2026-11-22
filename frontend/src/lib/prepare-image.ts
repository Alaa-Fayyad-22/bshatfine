// Prepares a photo in the BROWSER before it is uploaded (covers, council
// photos). Vercel refuses request bodies over 4.5 MB, so a phone photo cannot
// be sent as it is: it is decoded, turned upright, scaled down and re-encoded
// as a JPEG of at most 4 MB.
//
// Every photo is re-encoded, even a small one: the new file holds only pixels,
// so camera metadata (EXIF: GPS position, device, date...) never leaves the
// visitor's computer.

// What the admin may pick: photos straight from a phone or camera.
export const PHOTO_SOURCE_MAX_BYTES = 25 * 1024 * 1024;
// What is actually sent (fits Vercel's 4.5 MB with the multipart wrapper).
export const PHOTO_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
// Longest side of the uploaded photo, in pixels.
export const PHOTO_MAX_SIDE = 2560;
// JPEG qualities, tried in turn until the result fits PHOTO_UPLOAD_MAX_BYTES.
const QUALITIES = [0.85, 0.75, 0.65];

// For the file input's `accept`: only a hint for the picker, the content is
// checked below.
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";

export type PreparedImage =
  | { ok: true; file: File }
  // format: not a JPEG, PNG or WebP, or the browser cannot decode it (HEIC...)
  // sourceTooLarge: over PHOTO_SOURCE_MAX_BYTES before compression
  // tooLarge: still over PHOTO_UPLOAD_MAX_BYTES at the lowest quality
  | { ok: false; reason: "format" | "sourceTooLarge" | "tooLarge" };

// The message for each failure, in the Admin.form messages.
export const PHOTO_ERROR_KEYS = {
  format: "photoFormatError",
  sourceTooLarge: "photoSourceTooLarge",
  tooLarge: "photoTooLarge",
} as const;

type Format = "jpeg" | "png" | "webp";

// The real format, from the file's first bytes (its "magic number"): the name
// and the browser-reported type only reflect the extension.
async function sniffFormat(file: Blob): Promise<Format | null> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return "png";
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  return null;
}

// "IMG_1234.HEIC.png" -> "IMG_1234.HEIC.jpg"; a name without one gets ".jpg".
function jpegName(name: string): string {
  const base = name.replace(/\.[^./\\]*$/, "") || "photo";
  return `${base}.jpg`;
}

type Surface = {
  draw: (bitmap: ImageBitmap, width: number, height: number) => void;
  encode: (quality: number) => Promise<Blob | null>;
};

function createSurface(width: number, height: number): Surface | null {
  const paint = (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) =>
    (bitmap: ImageBitmap, w: number, h: number) => {
      // JPEG has no transparency: transparent pixels become white, not black.
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, w, h);
    };

  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      return {
        draw: paint(ctx),
        encode: (quality) =>
          canvas.convertToBlob({ type: "image/jpeg", quality }).catch(() => null),
      };
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  return {
    draw: paint(ctx),
    encode: (quality) =>
      new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality)),
  };
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (file.size > PHOTO_SOURCE_MAX_BYTES) return { ok: false, reason: "sourceTooLarge" };
  if (!(await sniffFormat(file))) return { ok: false, reason: "format" };

  let bitmap: ImageBitmap;
  try {
    // "from-image": apply the EXIF orientation, so a portrait photo stays upright.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return { ok: false, reason: "format" }; // damaged, or a format this browser cannot read
  }

  try {
    const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const surface = createSurface(width, height);
    if (!surface) return { ok: false, reason: "format" };
    surface.draw(bitmap, width, height);

    for (const quality of QUALITIES) {
      const blob = await surface.encode(quality);
      if (!blob || blob.type !== "image/jpeg") return { ok: false, reason: "format" };
      if (blob.size <= PHOTO_UPLOAD_MAX_BYTES) {
        return {
          ok: true,
          file: new File([blob], jpegName(file.name), {
            type: "image/jpeg",
            lastModified: Date.now(),
          }),
        };
      }
    }
    return { ok: false, reason: "tooLarge" };
  } finally {
    bitmap.close();
  }
}
