import type { Metadata } from "next";
import { site } from "@/config/site";
import { locales, localeTags, defaultLocale, type Locale } from "@/i18n/routing";

export const absoluteUrl = (path: string) => `${site.url}${path}`;

/** canonical + hreflang alternates (4 languages + x-default → English). */
export function alternates(locale: Locale, pathFor: (l: Locale) => string): Metadata["alternates"] {
  const languages: Record<string, string> = {};
  for (const l of locales) languages[localeTags[l]] = absoluteUrl(pathFor(l));
  languages["x-default"] = absoluteUrl(pathFor(defaultLocale));
  return { canonical: absoluteUrl(pathFor(locale)), languages };
}

export const ogLocale: Record<Locale, string> = { en: "en_US", es: "es_ES", fr: "fr_FR", pt: "pt_BR" };

interface PageMeta {
  title: string;
  description: string;
  url: string;
}

/**
 * Full Open Graph object for a page. Metadata merges shallowly, so a page that
 * sets `openGraph` replaces the layout's: every page repeats the shared fields.
 * The image comes from the `opengraph-image` file of the segment.
 */
export function openGraph(locale: Locale, page: PageMeta): Metadata["openGraph"] {
  return {
    ...page,
    siteName: site.name,
    type: "website",
    locale: ogLocale[locale],
    alternateLocale: locales.filter((l) => l !== locale).map((l) => ogLocale[l]),
  };
}

/** Large card; the image comes from the `twitter-image` file of the segment. */
export function twitter({ title, description }: Omit<PageMeta, "url">): Metadata["twitter"] {
  return { card: "summary_large_image", title, description };
}

/** The 512px logo as a schema.org ImageObject. */
export const logoImage = () => ({ "@type": "ImageObject", url: absoluteUrl(site.logo), width: 512, height: 512 });

/** Serialises JSON-LD safely for a <script> tag. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
