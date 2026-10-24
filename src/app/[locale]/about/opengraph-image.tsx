import { getTranslations } from "next-intl/server";
import { site } from "@/config/site";
import { defaultLocale, isLocale, locales } from "@/i18n/routing";
import { ogImage, ogSize } from "@/lib/og";

export const size = ogSize;
export const contentType = "image/png";
export const alt = site.name;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const t = await getTranslations({ locale, namespace: "about" });
  return ogImage({ title: t("title"), subtitle: t("description") });
}
