"use client";

import { useLocale } from "next-intl";
import { defaultLocale, isLocale, type Locale } from "@/i18n/routing";

export function useAppLocale(): Locale {
  const locale = useLocale();
  return isLocale(locale) ? locale : defaultLocale;
}
