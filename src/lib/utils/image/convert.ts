/** Pure helpers for the image converter: names, sizes and savings. */

export type ImageFormat = "webp" | "avif" | "jpeg" | "png";

export const MIME: Record<ImageFormat, string> = {
  webp: "image/webp",
  avif: "image/avif",
  jpeg: "image/jpeg",
  png: "image/png",
};

/** "photo.final.JPG" + webp → "photo.final.webp". */
export function outputName(name: string, format: ImageFormat): string {
  const base = name.replace(/\.[^./\\]+$/, "") || "image";
  return `${base}.${format === "jpeg" ? "jpg" : format}`;
}

/** Percent saved (negative when the output is larger). */
export function savings(before: number, after: number): number {
  if (before <= 0) return 0;
  return Math.round((1 - after / before) * 1000) / 10;
}

/** Fits width × height inside maxWidth (0 = no limit), keeping the aspect ratio and never upscaling. */
export function scaledSize(width: number, height: number, maxWidth: number): { width: number; height: number } {
  if (!maxWidth || width <= maxWidth) return { width, height };
  return { width: maxWidth, height: Math.max(1, Math.round((height * maxWidth) / width)) };
}
