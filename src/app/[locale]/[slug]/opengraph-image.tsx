import { getTranslations } from "next-intl/server";
import { findToolBySlug, tools } from "@/config/tools";
import { defaultLocale, isLocale, locales } from "@/i18n/routing";
import { ogCard, ogSize } from "@/lib/og";
import { toolPath } from "@/lib/routes";

export const size = ogSize;
export const contentType = "image/png";
export const alt = "kitforweb";

export function generateStaticParams() {
  return locales.flatMap((locale) => tools.map((tool) => ({ locale, slug: tool.slugs[locale] })));
}

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: raw, slug } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const tool = findToolBySlug(locale, slug);
  const t = await getTranslations({ locale, namespace: "tools" });
  if (!tool) return ogCard({ title: "kitforweb", subtitle: "", path: `/${locale}` });
  return ogCard({
    title: t(`${tool.id}.name`),
    subtitle: t(`${tool.id}.short`),
    path: toolPath(tool.id, locale),
  });
}
