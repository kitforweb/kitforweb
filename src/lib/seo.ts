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

/** Serialises JSON-LD safely for a <script> tag. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
