import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { ArrowRight, ShieldCheck, WifiOff, Zap } from "lucide-react";
import { GithubIcon } from "@/components/shared/brand-icons";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SmartDetector } from "@/components/home/smart-detector";
import { JsonLd } from "@/components/seo/json-ld";
import { DonateButton } from "@/components/shared/donate-button";
import { Logo } from "@/components/shared/logo";
import { site } from "@/config/site";
import { groupedTools } from "@/config/tools";
import { isLocale, localeTags, type Locale } from "@/i18n/routing";
import { aboutPath, homePath, toolPath } from "@/lib/routes";
import { absoluteUrl, alternates, logoImage, openGraph, twitter } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  const page = { title: t("homeTitle"), description: t("description") };
  return {
    title: { absolute: page.title },
    description: page.description,
    alternates: alternates(locale, homePath),
    openGraph: openGraph(locale, { ...page, url: absoluteUrl(homePath(locale)) }),
    twitter: twitter(page),
  };
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  setRequestLocale(locale);
  const t = await getTranslations();

  const points = [
    { Icon: ShieldCheck, title: t("home.point1Title"), text: t("home.point1Text") },
    { Icon: WifiOff, title: t("home.point2Title"), text: t("home.point2Text") },
    { Icon: Zap, title: t("home.point3Title"), text: t("home.point3Text") },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-8 pb-20 md:px-8 md:pt-14">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            "@id": `${site.url}/#organization`,
            name: site.name,
            url: site.url,
            logo: logoImage(),
            sameAs: [site.repository],
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: site.name,
            url: absoluteUrl(homePath(locale)),
            inLanguage: localeTags[locale],
            description: t("meta.description"),
            publisher: { "@id": `${site.url}/#organization` },
            potentialAction: {
              "@type": "SearchAction",
              target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl(homePath(locale))}?q={search_term_string}` },
              "query-input": "required name=search_term_string",
            },
          },
        ]}
      />

      <header className="max-w-3xl">
        <Logo blink className="mb-6 h-8 w-auto md:h-10" />
        <p className="mb-3 font-mono text-xs text-accent-text">
          <span aria-hidden>$ </span>
          {site.name} --{t("home.tagline")}
        </p>
        <h1 className="font-heading text-3xl leading-tight font-bold tracking-tight text-balance md:text-5xl">
          {t("home.title")}
        </h1>
        <p className="mt-4 text-base leading-7 text-pretty text-muted-foreground md:text-lg">{t("home.lead")}</p>
      </header>

      <ul className="mt-8 grid gap-3 sm:grid-cols-3">
        {points.map(({ Icon, title, text }) => (
          <li key={title} className="rounded-lg border bg-surface-1 p-4">
            <Icon className="mb-2 size-5 text-primary" aria-hidden />
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <SmartDetector />
      </div>

      <section aria-labelledby="all-tools" className="mt-14">
        <h2 id="all-tools" className="font-heading text-xl font-semibold">
          {t("home.toolsTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("home.toolsLead")}</p>
        <div className="mt-6 space-y-6">
          {groupedTools().map((group, i) => (
            <Fragment key={i}>
              {i > 0 && <hr className="border-border/70" />}
              <ul className="grid gap-3 sm:grid-cols-2">
                {group.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <li key={tool.id}>
                      <Link
                        href={toolPath(tool.id, locale)}
                        className="group flex h-full items-start gap-3 rounded-lg border bg-surface-1 p-4 transition-colors hover:border-primary/60 focus-visible:shadow-glow"
                      >
                        <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                        <span>
                          <span className="flex items-center gap-1 font-medium">
                            {t(`tools.${tool.id}.name`)}
                            <ArrowRight
                              className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100"
                              aria-hidden
                            />
                          </span>
                          <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                            {t(`tools.${tool.id}.short`)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Fragment>
          ))}
        </div>
      </section>

      <section aria-labelledby="about-teaser" className="mt-14 rounded-xl border bg-surface-1 p-6 md:p-8">
        <h2 id="about-teaser" className="font-heading text-lg font-semibold">
          {t("home.aboutTitle")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">{t("home.aboutText")}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <DonateButton />
          <Link href={aboutPath(locale)} className="text-sm text-accent-text underline-offset-4 hover:underline">
            {t("home.aboutLink")}
          </Link>
          <a
            href={site.repository}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <GithubIcon className="size-4" aria-hidden />
            {t("home.source")}
          </a>
        </div>
      </section>
    </div>
  );
}
