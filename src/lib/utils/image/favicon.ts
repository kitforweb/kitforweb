/** Every file a modern site needs, and the sizes they are rendered at. */
export interface IconSpec {
  file: string;
  size: number;
  /** Maskable icons keep the logo inside the central 80% safe zone. */
  maskable?: boolean;
  /** Apple ignores transparency: paint the background color. */
  opaque?: boolean;
}

export const ICON_SPECS: IconSpec[] = [
  { file: "favicon-16x16.png", size: 16 },
  { file: "favicon-32x32.png", size: 32 },
  { file: "favicon-48x48.png", size: 48 },
  { file: "apple-touch-icon.png", size: 180, opaque: true },
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "icon-maskable-512.png", size: 512, maskable: true, opaque: true },
];

/** Sizes bundled inside favicon.ico. */
export const ICO_SIZES = [16, 32, 48];

/**
 * An .ico file holding PNG images (supported by every browser since IE Vista):
 * a 6-byte header, a 16-byte directory entry per image, then the PNG data.
 */
export function buildIco(images: { size: number; png: Uint8Array }[]): Uint8Array {
  const header = 6;
  const entry = 16;
  let offset = header + entry * images.length;
  const total = offset + images.reduce((n, i) => n + i.png.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type: icon
  view.setUint16(4, images.length, true);
  images.forEach((img, i) => {
    const at = header + entry * i;
    // 0 means 256 in the one-byte width/height fields.
    view.setUint8(at, img.size >= 256 ? 0 : img.size);
    view.setUint8(at + 1, img.size >= 256 ? 0 : img.size);
    view.setUint8(at + 2, 0); // palette
    view.setUint8(at + 3, 0); // reserved
    view.setUint16(at + 4, 1, true); // color planes
    view.setUint16(at + 6, 32, true); // bits per pixel
    view.setUint32(at + 8, img.png.length, true);
    view.setUint32(at + 12, offset, true);
    out.set(img.png, offset);
    offset += img.png.length;
  });
  return out;
}

export interface ManifestInput {
  name: string;
  shortName: string;
  themeColor: string;
  backgroundColor: string;
}

export function webManifest(m: ManifestInput): string {
  return (
    JSON.stringify(
      {
        name: m.name,
        short_name: m.shortName || m.name,
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        theme_color: m.themeColor,
        background_color: m.backgroundColor,
        display: "standalone",
      },
      null,
      2,
    ) + "\n"
  );
}

/** The <head> tags, including favicon.svg only when the source was an SVG. */
export function linkTags(hasSvg: boolean, themeColor: string): string {
  return [
    '<link rel="icon" href="/favicon.ico" sizes="48x48">',
    hasSvg ? '<link rel="icon" href="/favicon.svg" type="image/svg+xml">' : null,
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
    `<meta name="theme-color" content="${themeColor.replace(/"/g, "&quot;")}">`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Where to draw the source inside a square of `size`, keeping its aspect ratio. */
export function fitRect(
  width: number,
  height: number,
  size: number,
  padding: number,
): { x: number; y: number; w: number; h: number } {
  const box = size * (1 - 2 * padding);
  const scale = Math.min(box / width, box / height);
  const w = width * scale;
  const h = height * scale;
  return { x: (size - w) / 2, y: (size - h) / 2, w, h };
}
