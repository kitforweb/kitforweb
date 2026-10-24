import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Geist, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { IdeShell } from "@/components/layout/ide-shell";
import { site } from "@/config/site";
import { clientMessages } from "@/i18n/messages";
import { isLocale, locales, localeTags } from "@/i18n/routing";
import { absoluteUrl, alternates, openGraph, twitter } from "@/lib/seo";
import { homePath } from "@/lib/routes";
import { themeBootScript } from "@/lib/workspace-store";
import "../globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"], display: "swap" });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], display: "swap" });

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: site.brandColor },
    { media: "(prefers-color-scheme: light)", color: "#f7f9fb" },
  ],
  colorScheme: "dark light",
};

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  const page = { title: t("title"), description: t("description") };
  // Icons, manifest and social images come from the metadata files in app/.
  return {
    metadataBase: new URL(site.url),
    title: { default: page.title, template: `%s · ${site.name}` },
    description: page.description,
    applicationName: site.name,
    alternates: alternates(locale, homePath),
    openGraph: openGraph(locale, { ...page, url: absoluteUrl(homePath(locale)) }),
    twitter: twitter(page),
    robots: { index: true, follow: true },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const messages = clientMessages(await getMessages());

  return (
    <html
      lang={localeTags[locale]}
      className={`dark ${geist.variable} ${jetbrainsMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <IdeShell>{children}</IdeShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
