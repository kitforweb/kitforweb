export interface MetaInput {
  title: string;
  description: string;
  url: string;
  image: string;
  siteName: string;
  type: "website" | "article" | "product";
  twitterSite: string;
  locale: string;
}

/** Approximate limits before search engines and social networks cut the text. */
export const LIMITS = {
  title: 60,
  description: 160,
  ogTitle: 90,
  ogDescription: 200,
} as const;

export type LengthStatus = "empty" | "short" | "ok" | "long";

export function lengthStatus(text: string, max: number, min = Math.round(max / 3)): LengthStatus {
  const n = [...text.trim()].length;
  if (n === 0) return "empty";
  if (n < min) return "short";
  return n > max ? "long" : "ok";
}

/** Cuts at a word boundary and adds an ellipsis, like the previews do. */
export function truncate(text: string, max: number): string {
  const chars = [...text.trim()];
  if (chars.length <= max) return chars.join("");
  const cut = chars.slice(0, max - 1).join("");
  // The cut already ends a word when the next character is a space.
  if (chars[max - 1] === " ") return `${cut.trimEnd()}…`;
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** <title>, description, canonical, Open Graph and Twitter Card tags, ready to paste. */
export function generateMetaTags(m: MetaInput): string {
  const lines: string[] = [];
  const add = (cond: unknown, line: string) => cond && lines.push(line);
  add(m.title, `<title>${esc(m.title)}</title>`);
  add(m.description, `<meta name="description" content="${esc(m.description)}" />`);
  add(m.url, `<link rel="canonical" href="${esc(m.url)}" />`);
  lines.push("");
  lines.push("<!-- Open Graph -->");
  lines.push(`<meta property="og:type" content="${m.type}" />`);
  add(m.title, `<meta property="og:title" content="${esc(m.title)}" />`);
  add(m.description, `<meta property="og:description" content="${esc(m.description)}" />`);
  add(m.url, `<meta property="og:url" content="${esc(m.url)}" />`);
  add(m.image, `<meta property="og:image" content="${esc(m.image)}" />`);
  add(m.image, `<meta property="og:image:width" content="1200" />`);
  add(m.image, `<meta property="og:image:height" content="630" />`);
  add(m.siteName, `<meta property="og:site_name" content="${esc(m.siteName)}" />`);
  add(m.locale, `<meta property="og:locale" content="${esc(m.locale)}" />`);
  lines.push("");
  lines.push("<!-- Twitter / X -->");
  lines.push(`<meta name="twitter:card" content="${m.image ? "summary_large_image" : "summary"}" />`);
  add(m.twitterSite, `<meta name="twitter:site" content="@${esc(m.twitterSite.replace(/^@/, ""))}" />`);
  add(m.title, `<meta name="twitter:title" content="${esc(m.title)}" />`);
  add(m.description, `<meta name="twitter:description" content="${esc(m.description)}" />`);
  add(m.image, `<meta name="twitter:image" content="${esc(m.image)}" />`);
  return lines.join("\n");
}

/** "https://www.example.com/blog/post" → "example.com › blog › post", like Google shows it. */
export function breadcrumbUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return [u.hostname.replace(/^www\./, ""), ...parts].join(" › ");
  } catch {
    return url;
  }
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
