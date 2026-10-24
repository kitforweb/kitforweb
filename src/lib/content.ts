import type { ComponentType } from "react";
import type { ToolId } from "@/config/tools";
import { defaultLocale, type Locale } from "@/i18n/routing";

export interface FaqEntry {
  q: string;
  a: string;
}

interface ToolContentModule {
  default: ComponentType;
  faq?: FaqEntry[];
}

export interface ToolContent {
  Body: ComponentType;
  faq: FaqEntry[];
  /** Language the content is actually written in (falls back to English). */
  locale: Locale;
}

/**
 * SEO content for a tool: `src/content/<tool>/<locale>.mdx`. Each file exports
 * its FAQ as `export const faq = [...]` so it can also feed the FAQPage JSON-LD.
 */
export async function loadToolContent(id: ToolId, locale: Locale): Promise<ToolContent | null> {
  for (const l of locale === defaultLocale ? [locale] : [locale, defaultLocale]) {
    try {
      const mod = (await import(`@/content/${id}/${l}.mdx`)) as ToolContentModule;
      return { Body: mod.default, faq: mod.faq ?? [], locale: l };
    } catch {
      // Not translated yet: try the next language.
    }
  }
  return null;
}
