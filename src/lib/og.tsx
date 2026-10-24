import { ImageResponse } from "next/og";
import { site } from "@/config/site";
import { loadOgFonts, loadWordmarkSrc, ogCard, ogSize } from "./og-card";

export { ogSize };

// Read once per worker: the assets never change between images.
const fonts = loadOgFonts();
const wordmarkSrc = loadWordmarkSrc();

/** Shared Open Graph / Twitter card: wordmark, title, short description and footer. */
export function ogImage({ title, subtitle }: { title: string; subtitle: string }) {
  return new ImageResponse(ogCard({ title, subtitle, footer: `100% local · ${site.name}`, wordmarkSrc }), {
    ...ogSize,
    fonts,
  });
}
