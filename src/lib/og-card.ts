/**
 * Open Graph card layout shared by the `opengraph-image` routes and
 * `scripts/generate-icons.mjs` (GitHub social preview). Plain TypeScript with
 * no JSX and no path aliases, so Node can run it directly with type stripping.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement as h, type ReactElement } from "react";

export const brand = {
  background: "#0B1120",
  text: "#E2E8F0",
  muted: "#94A3B8",
  accent: "#22D3EE",
} as const;

export const ogSize = { width: 1200, height: 630 };

/** ImageResponse needs TTF/OTF/WOFF (no WOFF2). */
export function loadOgFonts(root = process.cwd()) {
  const file = (weight: number) =>
    readFileSync(
      join(root, `node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-${weight}-normal.woff`),
    );
  return [
    { name: "JetBrains Mono", data: file(400), weight: 400 as const, style: "normal" as const },
    { name: "JetBrains Mono", data: file(700), weight: 700 as const, style: "normal" as const },
  ];
}

/** The dark wordmark as a data URL (the source SVG is not served). */
export function loadWordmarkSrc(root = process.cwd()): string {
  const svg = readFileSync(join(root, "assets/images/logo-wordmark-dark.svg"));
  return `data:image/svg+xml;base64,${svg.toString("base64")}`;
}

const PADDING_X = 72;
// JetBrains Mono glyphs are 0.6em wide.
const CHAR_WIDTH = 0.6;

/** One line as large as fits (up to 84px); long titles wrap at 56px. */
function titleSize(title: string, contentWidth: number): number {
  const oneLine = Math.floor(contentWidth / (CHAR_WIDTH * title.length));
  return oneLine >= 56 ? Math.min(oneLine, 84) : 56;
}

export interface OgCardProps {
  title: string;
  subtitle: string;
  footer: string;
  wordmarkSrc: string;
  width?: number;
  height?: number;
}

export function ogCard({ title, subtitle, footer, wordmarkSrc, width = ogSize.width }: OgCardProps): ReactElement {
  const grid = "rgba(34, 211, 238, 0.07)";
  return h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: `64px ${PADDING_X}px`,
        backgroundColor: brand.background,
        backgroundImage: `linear-gradient(${grid} 1px, transparent 1px), linear-gradient(90deg, ${grid} 1px, transparent 1px)`,
        backgroundSize: "48px 48px",
        color: brand.text,
        fontFamily: "JetBrains Mono",
      },
    },
    h("img", { src: wordmarkSrc, width: 280, height: Math.round((280 * 91) / 567), alt: "" }),
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 24 } },
      h(
        "div",
        { style: { fontSize: titleSize(title, width - 2 * PADDING_X), fontWeight: 700, lineHeight: 1.1 } },
        title,
      ),
      subtitle && h("div", { style: { fontSize: 30, lineHeight: 1.4, color: brand.muted } }, subtitle),
    ),
    h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: brand.muted } },
      footer,
      h("div", { style: { width: 15, height: 30, backgroundColor: brand.accent, borderRadius: 2 } }),
    ),
  );
}
