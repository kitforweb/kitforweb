/** Browser-only image helpers (canvas, decoding, encoding). Pure logic lives in lib/utils/image. */

export interface LoadedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  /** Object URL for <img> previews; revoke it with dispose(). */
  url: string;
  dispose: () => void;
}

/** Decodes a file (PNG, JPEG, WebP, GIF, SVG…) into something drawable. */
export async function loadImage(file: Blob): Promise<LoadedImage> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  // SVGs without width/height decode at 0×0 or 150×150 in some browsers: give them a size.
  const width = img.naturalWidth || 512;
  const height = img.naturalHeight || 512;
  return { source: img, width, height, url, dispose: () => URL.revokeObjectURL(url) };
}

export function createCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available");
  ctx.imageSmoothingQuality = "high";
  return [canvas, ctx];
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(`Cannot encode ${type}`))), type, quality),
  );
}

const support = new Map<string, Promise<boolean>>();

/** Whether this browser can encode `type` from a canvas (it silently falls back to PNG when not). */
export function canEncode(type: string): Promise<boolean> {
  let p = support.get(type);
  if (!p) {
    p = (async () => {
      try {
        const [canvas] = createCanvas(2, 2);
        const blob = await canvasToBlob(canvas, type, 0.5);
        return blob.type === type;
      } catch {
        return false;
      }
    })();
    support.set(type, p);
  }
  return p;
}
