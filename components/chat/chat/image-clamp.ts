// Clamp a pasted/attached image before it rides the chat RPC inline. No
// reference harness sends originals: codex resizes to 2048px before every
// request, goose downscales to 1024px in the browser — we were sending up to
// 50 MB of base64 straight to the model, the likeliest trigger for the empty
// responses a new user hit 3× (2026-08-21). 2048px keeps logos/screenshots
// fully legible to the model while capping the payload at the source.
//
// `fitWithin` is the pure, tested part. `clampImage` is browser glue and
// degrades to the ORIGINAL bytes on any failure (unsupported type, canvas
// error, decode failure) — a clamp must never cost the user their attachment.

export const MAX_IMAGE_EDGE = 2048;

/** Target size that fits `w×h` inside `max×max`, preserving aspect; never
 *  upscales. Returns the input unchanged when it already fits. */
export function fitWithin(w: number, h: number, max = MAX_IMAGE_EDGE): { w: number; h: number } {
  if (!(w > 0) || !(h > 0)) return { w, h };
  const longest = Math.max(w, h);
  if (longest <= max) return { w, h };
  const s = max / longest;
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

/** Only raster types a canvas can re-encode deterministically; SVG/HEIC/etc.
 *  pass through untouched (the agent still persists + sees them). */
export function isClampable(mime: string): boolean {
  return mime === "image/png" || mime === "image/jpeg" || mime === "image/webp";
}

export type ClampedImage = { blob: Blob; mimeType: string; width: number; height: number; clamped: boolean };

/** Decode → fit → re-encode. PNG stays PNG (alpha); JPEG/WebP → JPEG q0.9.
 *  Resolves to the original file (clamped:false) whenever it already fits or
 *  anything goes wrong. */
export async function clampImage(file: File, max = MAX_IMAGE_EDGE): Promise<ClampedImage> {
  const passthrough = (): ClampedImage => ({ blob: file, mimeType: file.type, width: 0, height: 0, clamped: false });
  if (!isClampable(file.type) || typeof createImageBitmap !== "function") return passthrough();
  try {
    const bmp = await createImageBitmap(file);
    const { w, h } = fitWithin(bmp.width, bmp.height, max);
    if (w === bmp.width && h === bmp.height) {
      bmp.close?.();
      return { blob: file, mimeType: file.type, width: w, height: h, clamped: false };
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return passthrough();
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outType, outType === "image/jpeg" ? 0.9 : undefined),
    );
    if (!blob) return passthrough();
    return { blob, mimeType: outType, width: w, height: h, clamped: true };
  } catch {
    return passthrough();
  }
}

/** Blob → raw base64 (no data-URL prefix) + the data URL for the preview. */
export function blobToBase64(blob: Blob): Promise<{ base64: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve({ base64: dataUrl.split(",")[1] ?? "", dataUrl });
    };
    reader.readAsDataURL(blob);
  });
}
