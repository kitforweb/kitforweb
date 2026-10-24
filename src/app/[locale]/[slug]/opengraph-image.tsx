import { getTranslations } from "next-intl/server";
import { site } from "@/config/site";
import { findToolBySlug, tools } from "@/config/tools";
import { defaultLocale, isLocale, locales } from "@/i18n/routing";
import { ogImage, ogSize } from "@/lib/og";

export const size = ogSize;
export const contentType = "image/png";
export const alt = site.name;

export function generateStaticParams() {
  return locales.flatMap((locale) => tools.map((tool) => ({ locale, slug: tool.slugs[locale] })));
}

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: raw, slug } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const tool = findToolBySlug(locale, slug);
  const t = await getTranslations({ locale, namespace: "tools" });
  if (!tool) return ogImage({ title: site.name, subtitle: "" });
  return ogImage({ title: t(`${tool.id}.name`), subtitle: t(`${tool.id}.short`) });
}
