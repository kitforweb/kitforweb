import type { Metadata } from "next";
import { Globe } from "lucide-react";
import { GithubIcon, LinkedinIcon } from "@/components/shared/brand-icons";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { JsonLd } from "@/components/seo/json-ld";
import { DonateButton } from "@/components/shared/donate-button";
import { Logo } from "@/components/shared/logo";
import { site } from "@/config/site";
import { isLocale, type Locale } from "@/i18n/routing";
import { aboutPath } from "@/lib/routes";
import { absoluteUrl, alternates, logoImage, openGraph, twitter } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "about" });
  const page = { title: `${t("title")} · ${site.name}`, description: t("description") };
  return {
    title: t("title"),
    description: page.description,
    alternates: alternates(locale, aboutPath),
    openGraph: openGraph(locale, { ...page, url: absoluteUrl(aboutPath(locale)) }),
    twitter: twitter(page),
  };
}

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  setRequestLocale(locale);
  const t = await getTranslations("about");

  const links = [
    { href: site.author.github, label: "GitHub", Icon: GithubIcon },
    { href: site.author.linkedin, label: "LinkedIn", Icon: LinkedinIcon },
    { href: site.author.portfolio, label: t("portfolio"), Icon: Globe },
  ].filter((l) => l.href);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-10 pb-20 md:px-8 md:pt-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Person",
          name: site.author.name,
          url: absoluteUrl(aboutPath(locale)),
          // schema.org has no `logo` on Person: `image` is its equivalent.
          image: logoImage(),
          sameAs: links.map((l) => l.href),
          knowsAbout: ["Web development", "Frontend", "TypeScript"],
        }}
      />
      <Logo className="mb-8 h-6 w-auto" />
      <p className="mb-3 font-mono text-xs text-accent-text">
        <span aria-hidden>$ </span>whoami
      </p>
      <h1 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">{t("title")}</h1>
      <div className="prose-tool mt-6">
        <p>{t("p1")}</p>
        <p>{t("p2")}</p>
        <h2>{t("whyTitle")}</h2>
        <p>{t("why")}</p>
        <h2>{t("privacyTitle")}</h2>
        <p>
          {t.rich("privacy", {
            repo: (chunks) => (
              <a href={site.repository} target="_blank" rel="noopener noreferrer">
                {chunks}
              </a>
            ),
          })}
        </p>
      </div>
      <ul className="mt-8 flex flex-wrap gap-3">
        {links.map(({ href, label, Icon }) => (
          <li key={label}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer me"
              className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm hover:border-primary/60"
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </a>
          </li>
        ))}
      </ul>
      <section aria-labelledby="donate" className="mt-12 rounded-xl border bg-surface-1 p-6">
        <h2 id="donate" className="font-heading text-lg font-semibold">
          {t("donateTitle")}
        </h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">{t("donateText")}</p>
        <DonateButton className="mt-4" />
      </section>
    </div>
  );
}
