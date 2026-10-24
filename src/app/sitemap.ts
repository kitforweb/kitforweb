import type { MetadataRoute } from "next";
import { tools } from "@/config/tools";
import { defaultLocale, locales, localeTags, type Locale } from "@/i18n/routing";
import { aboutPath, homePath, toolPath } from "@/lib/routes";
import { absoluteUrl } from "@/lib/seo";

function entries(pathFor: (l: Locale) => string, priority: number): MetadataRoute.Sitemap {
  const languages: Record<string, string> = Object.fromEntries(
    locales.map((l) => [localeTags[l], absoluteUrl(pathFor(l))]),
  );
  languages["x-default"] = absoluteUrl(pathFor(defaultLocale));
  return locales.map((l) => ({
    url: absoluteUrl(pathFor(l)),
    changeFrequency: "monthly",
    priority,
    alternates: { languages },
  }));
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...entries(homePath, 1),
    ...tools.flatMap((tool) => entries((l) => toolPath(tool.id, l), 0.8)),
    ...entries(aboutPath, 0.3),
  ];
}
