import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { defaultLocale, isLocale } from "@/i18n/routing";
import { homePath } from "@/lib/routes";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  const raw = await getLocale();
  const locale = isLocale(raw) ? raw : defaultLocale;
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="font-mono text-sm text-accent-text">404</p>
      <h1 className="mt-2 font-heading text-2xl font-bold">{t("title")}</h1>
      <p className="mt-3 text-muted-foreground">{t("text")}</p>
      <Link href={homePath(locale)} className="mt-6 inline-block text-accent-text underline underline-offset-4">
        {t("back")}
      </Link>
    </div>
  );
}
