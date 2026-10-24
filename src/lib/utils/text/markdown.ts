/** Helpers for the Markdown editor that do not need the renderer. */

export interface MarkdownStats {
  words: number;
  characters: number;
  lines: number;
  /** Minutes at 200 words per minute, at least 1 when there is text. */
  readingMinutes: number;
}

export interface Heading {
  depth: number;
  text: string;
  slug: string;
}

/** Text without fenced code blocks, so their content is not counted as prose or headings. */
function withoutFences(md: string): string {
  return md.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, "");
}

export function markdownStats(md: string): MarkdownStats {
  const prose = withoutFences(md)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|-]/g, " ");
  const words = prose.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return {
    words,
    characters: md.length,
    lines: md === "" ? 0 : md.split(/\r?\n/).length,
    readingMinutes: words === 0 ? 0 : Math.max(1, Math.round(words / 200)),
  };
}

/** GitHub-style anchor: lower case, punctuation removed, spaces to dashes. */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

/** ATX headings (# Title) in order, with unique GitHub-style slugs. */
export function extractHeadings(md: string): Heading[] {
  const seen = new Map<string, number>();
  const out: Heading[] = [];
  for (const line of withoutFences(md).split(/\r?\n/)) {
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const text = m[2].replace(/[*_`]/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
    const base = slugify(text);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.push({ depth: m[1].length, text, slug: n === 0 ? base : `${base}-${n}` });
  }
  return out;
}

/** A Markdown table of contents for the headings (skipping the document title). */
export function tableOfContents(headings: Heading[]): string {
  const list = headings.length > 1 && headings[0].depth === 1 ? headings.slice(1) : headings;
  if (list.length === 0) return "";
  const min = Math.min(...list.map((h) => h.depth));
  return list.map((h) => `${"  ".repeat(h.depth - min)}- [${h.text}](#${h.slug})`).join("\n") + "\n";
}

const DOCUMENT_CSS = `body{max-width:760px;margin:40px auto;padding:0 16px;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#1f2328}
h1,h2{border-bottom:1px solid #d1d9e0;padding-bottom:.3em}
code{background:#eff1f3;padding:.2em .4em;border-radius:6px;font-size:85%}
pre{background:#f6f8fa;padding:16px;border-radius:6px;overflow:auto}
pre code{background:none;padding:0}
table{border-collapse:collapse}th,td{border:1px solid #d1d9e0;padding:6px 13px}
blockquote{margin:0;padding:0 1em;color:#59636e;border-left:.25em solid #d1d9e0}
img{max-width:100%}`;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** A standalone HTML document around the rendered body, with GitHub-like styles. */
export function htmlDocument(body: string, title: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title || "Document")}</title>
<style>
${DOCUMENT_CSS}
</style>
</head>
<body>
${body}
</body>
</html>
`;
}
