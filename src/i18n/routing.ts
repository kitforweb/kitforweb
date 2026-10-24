import { defineRouting } from "next-intl/routing";

export const locales = ["en", "es", "fr", "pt"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

/** BCP 47 tags used for `hreflang` and `Intl`. */
export const localeTags: Record<Locale, string> = {
  en: "en",
  es: "es",
  fr: "fr",
  pt: "pt-BR",
};

export const localeNames: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  pt: "Português (BR)",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
  // Language negotiation only happens on "/" (see src/proxy.ts).
  localeDetection: false,
});
