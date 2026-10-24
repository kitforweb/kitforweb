/**
 * Generates every brand file the site and the repository serve, from the
 * sources in assets/images/ (which are never served directly).
 *
 *   npm run generate:icons
 *
 * Re-run it after changing any source SVG or the Open Graph card layout.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import nextOg from "next/og.js";
import sharp from "sharp";
import { loadOgFonts, loadWordmarkSrc, ogCard } from "../src/lib/og-card.ts";
import { buildIco, ICO_SIZES } from "../src/lib/utils/image/favicon.ts";

const { ImageResponse } = nextOg;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (name) => join(root, "assets/images", name);

function write(path, data) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
  console.log(`  ${relative(root, target).replaceAll("\\", "/")}`);
}

function copy(from, to) {
  write(to, readFileSync(from));
}

const png = (svg, size) => sharp(svg, { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

const icon = readFileSync(source("logo-icon.svg"));

// Full-bleed variant for maskable and Apple icons: square background, no border.
// The "k" and the cursor already sit inside the central 80% safe zone.
const fullBleedText = icon
  .toString()
  .replace(/(<rect id="background"[^>]*?) rx="[^"]+"/, "$1")
  .replace(/\s*<!-- Subtle cyan border -->\s*<rect id="border"[^>]*\/>/, "");
if (fullBleedText.includes('id="border"') || /id="background"[^>]*rx=/.test(fullBleedText)) {
  throw new Error("logo-icon.svg changed: update the full-bleed variant in generate-icons.mjs");
}
const fullBleed = Buffer.from(fullBleedText);

console.log("Favicons (src/app):");
copy(source("logo-icon.svg"), "src/app/icon.svg");
const icoImages = await Promise.all(ICO_SIZES.map(async (size) => ({ size, png: await png(icon, size) })));
write("src/app/favicon.ico", buildIco(icoImages));
write("src/app/apple-icon.png", await png(fullBleed, 180));

console.log("PWA and JSON-LD icons (public/brand):");
write("public/brand/icon-192.png", await png(icon, 192));
write("public/brand/icon-512.png", await png(icon, 512));
write("public/brand/icon-maskable-512.png", await png(fullBleed, 512));

console.log("README logos (docs/brand):");
copy(source("logo-wordmark-dark.svg"), "docs/brand/logo-dark.svg");
copy(source("logo-wordmark-light.svg"), "docs/brand/logo-light.svg");

console.log("GitHub social preview (same card as the home Open Graph image):");
const messages = JSON.parse(readFileSync(join(root, "src/i18n/messages/en.json"), "utf8"));
const preview = new ImageResponse(
  ogCard({
    title: messages.home.title,
    subtitle: messages.home.ogSubtitle,
    footer: "100% local · kitforweb",
    wordmarkSrc: loadWordmarkSrc(root),
    width: 1280,
  }),
  { width: 1280, height: 640, fonts: loadOgFonts(root) },
);
const previewPng = Buffer.from(await preview.arrayBuffer());
write("docs/brand/github-social-preview.png", previewPng);

console.log("Tool examples (public/examples):");
copy(source("logo-icon.svg"), "public/examples/logo-icon.svg");
copy(source("logo-wordmark-dark.svg"), "public/examples/logo-wordmark-dark.svg");
write("public/examples/kitforweb-banner.png", previewPng);
