import { getTranslations } from "next-intl/server";
import { defaultLocale, isLocale, locales } from "@/i18n/routing";
import { ogCard, ogSize } from "@/lib/og";

export const size = ogSize;
export const contentType = "image/png";
export const alt = "kitforweb";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const t = await getTranslations({ locale, namespace: "home" });
  return ogCard({ title: t("title"), subtitle: t("ogSubtitle"), path: `/${locale}` });
}
