import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { JsonLd } from "@/components/seo/json-ld";
import { ToolWorkspace } from "@/components/tools/tool-workspace";
import { site } from "@/config/site";
import { findToolBySlug, tools } from "@/config/tools";
import { clientMessages } from "@/i18n/messages";
import { isLocale, localeTags, type Locale } from "@/i18n/routing";
import { loadToolContent } from "@/lib/content";
import { homePath, toolPath } from "@/lib/routes";
import { absoluteUrl, alternates, ogLocale } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  return tools.map((tool) => ({ slug: tool.slugs[locale] }));
}

async function resolve(params: PageProps<"/[locale]/[slug]">["params"]) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const tool = findToolBySlug(locale, slug);
  if (!tool) notFound();
  return { locale, tool };
}

export async function generateMetadata({ params }: PageProps<"/[locale]/[slug]">): Promise<Metadata> {
  const { locale, tool } = await resolve(params);
  const t = await getTranslations({ locale, namespace: `tools.${tool.id}` });
  return {
    title: t("title"),
    description: t("description"),
    keywords: tool.keywords,
    alternates: alternates(locale, (l) => toolPath(tool.id, l)),
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: absoluteUrl(toolPath(tool.id, locale)),
      locale: ogLocale[locale],
      type: "website",
    },
  };
}

export default async function ToolPage({ params }: PageProps<"/[locale]/[slug]">) {
  const { locale, tool } = await resolve(params);
  setRequestLocale(locale);
  const t = await getTranslations();
  const content = await loadToolContent(tool.id, locale);
  const name = t(`tools.${tool.id}.name`);
  const url = absoluteUrl(toolPath(tool.id, locale));

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name,
      url,
      description: t(`tools.${tool.id}.description`),
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript",
      inLanguage: localeTags[locale],
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
      publisher: { "@type": "Organization", name: site.name, url: site.url },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: site.name, item: absoluteUrl(homePath(locale)) },
        { "@type": "ListItem", position: 2, name, item: url },
      ],
    },
    ...(content && content.faq.length > 0
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            inLanguage: localeTags[content.locale],
            mainEntity: content.faq.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto w-full max-w-[1600px] px-3 pt-3 pb-16 md:px-4">
      <JsonLd data={structuredData} />
      <header className="mb-3 flex flex-col gap-1 md:flex-row md:items-baseline md:gap-4">
        <nav aria-label={t("nav.breadcrumb")} className="hidden md:block">
          <ol className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
            <li>
              <Link href={homePath(locale)} className="hover:text-foreground">
                {site.name}
              </Link>
            </li>
            <li aria-hidden>
              <ChevronRight className="size-3" />
            </li>
            <li aria-current="page" className="text-foreground">
              {tool.slugs[locale]}
            </li>
          </ol>
        </nav>
        <h1 className="font-heading text-lg font-semibold tracking-tight md:text-xl">{t(`tools.${tool.id}.h1`)}</h1>
        <p className="text-sm text-muted-foreground md:truncate">{t(`tools.${tool.id}.lead`)}</p>
      </header>

      <NextIntlClientProvider messages={clientMessages(await getMessages(), tool.id, tool.messages)}>
        <ToolWorkspace toolId={tool.id} />
      </NextIntlClientProvider>

      {content && (
        <article className="prose-tool mx-auto mt-12 max-w-3xl" lang={localeTags[content.locale]}>
          <content.Body />
          {content.faq.length > 0 && (
            <section aria-labelledby="faq">
              <h2 id="faq">{t("seo.faq")}</h2>
              {content.faq.map((f) => (
                <details key={f.q} className="group border-b py-3">
                  <summary className="cursor-pointer list-none font-medium text-foreground marker:hidden">
                    <span className="me-2 inline-block text-primary transition-transform group-open:rotate-90">›</span>
                    {f.q}
                  </summary>
                  <p className="mt-2 ps-5">{f.a}</p>
                </details>
              ))}
            </section>
          )}
        </article>
      )}
    </div>
  );
}
