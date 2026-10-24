import { getTool, findToolBySlug, type ToolId } from "@/config/tools";
import { isLocale, type Locale } from "@/i18n/routing";

export const homePath = (locale: Locale) => `/${locale}`;
export const aboutPath = (locale: Locale) => `/${locale}/about`;
export const toolPath = (id: ToolId, locale: Locale) => `/${locale}/${getTool(id).slugs[locale]}`;

/** Maps the current pathname to the equivalent page in another locale. */
export function switchLocalePath(pathname: string, target: Locale): string {
  const [, current, slug] = pathname.split("/");
  if (!current || !isLocale(current) || !slug) return homePath(target);
  if (slug === "about") return aboutPath(target);
  const tool = findToolBySlug(current, slug);
  return tool ? toolPath(tool.id, target) : homePath(target);
}

/** Returns the tool shown at `pathname`, if any. */
export function toolFromPath(pathname: string): ToolId | undefined {
  const [, locale, slug] = pathname.split("/");
  if (!locale || !isLocale(locale) || !slug) return undefined;
  return findToolBySlug(locale, slug)?.id;
}
