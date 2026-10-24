import { installBridge, serialize } from "./console-bridge";

export type LibraryKind = "script" | "style";

export interface Library {
  /** Stable id (catalog libraries) or the URL (custom ones). */
  id: string;
  name: string;
  kind: LibraryKind;
  url: string;
}

/** Popular libraries, one click away. Module libraries go through the import map instead. */
export const QUICK_LIBRARIES: Library[] = [
  {
    id: "tailwind",
    name: "Tailwind CSS 4",
    kind: "script",
    url: "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4",
  },
  { id: "pico", name: "Pico CSS", kind: "style", url: "https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" },
  {
    id: "bootstrap",
    name: "Bootstrap 5 (CSS)",
    kind: "style",
    url: "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css",
  },
  {
    id: "animate",
    name: "Animate.css",
    kind: "style",
    url: "https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css",
  },
  {
    id: "jquery",
    name: "jQuery 3",
    kind: "script",
    url: "https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js",
  },
  { id: "lodash", name: "Lodash", kind: "script", url: "https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js" },
  { id: "alpine", name: "Alpine.js", kind: "script", url: "https://unpkg.com/alpinejs@3.14.1/dist/cdn.min.js" },
  {
    id: "chartjs",
    name: "Chart.js",
    kind: "script",
    url: "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js",
  },
  { id: "gsap", name: "GSAP", kind: "script", url: "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js" },
  { id: "dayjs", name: "Day.js", kind: "script", url: "https://cdn.jsdelivr.net/npm/dayjs@1.11.13/dayjs.min.js" },
];

/** Packages commonly imported as ES modules, resolved through esm.sh. */
export const QUICK_IMPORTS = [
  "react",
  "react-dom/client",
  "vue",
  "preact",
  "lit",
  "three",
  "canvas-confetti",
  "nanoid",
  "date-fns",
];

export const CDN_HOSTS = ["cdn.jsdelivr.net", "unpkg.com", "cdnjs.cloudflare.com", "esm.sh"];

export type LibraryUrlResult = { ok: true; library: Library } | { ok: false; error: "url" | "https" | "host" };

/** Accepts https URLs from the supported CDNs; .css files are stylesheets, the rest scripts. */
export function parseLibraryUrl(text: string): LibraryUrlResult {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return { ok: false, error: "url" };
  }
  if (url.protocol !== "https:") return { ok: false, error: "https" };
  if (!CDN_HOSTS.includes(url.hostname)) return { ok: false, error: "host" };
  const kind: LibraryKind = /\.css$/i.test(url.pathname) ? "style" : "script";
  const name = decodeURIComponent(url.pathname.split("/").filter(Boolean).slice(-1)[0] ?? url.hostname);
  return { ok: true, library: { id: url.href, name, kind, url: url.href } };
}

/** "react" → https://esm.sh/react, "react@18" → https://esm.sh/react@18. Null for invalid names. */
export function esmUrl(specifier: string): string | null {
  const s = specifier.trim();
  if (!/^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*(@[\w.^~*-]+)?(\/[\w./-]+)?$/i.test(s)) return null;
  return `https://esm.sh/${s}`;
}

/** Bare name of an import ("react@18/jsx-runtime" → "react/jsx-runtime"). */
export function importName(specifier: string): string {
  return specifier.trim().replace(/^((?:@[^/]+\/)?[^@/]+)@[^/]+/, "$1");
}

export function buildImportMap(specifiers: string[]): Record<string, string> {
  const imports: Record<string, string> = {};
  for (const s of specifiers) {
    const url = esmUrl(s);
    if (url) imports[importName(s)] = url;
  }
  return imports;
}

export interface PlaygroundSource {
  html: string;
  css: string;
  js: string;
  libraries: Library[];
  imports: string[];
  /** Run the JS as an ES module (needed for `import`). */
  module: boolean;
}

/** Text that cannot close the <script> or <style> element it lives in. */
const inScript = (code: string) => code.replace(/<\/(script)/gi, "<\\/$1");
const inStyle = (code: string) => code.replace(/<\/(style)/gi, "<\\/$1");
const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** The full document loaded in the sandboxed iframe (srcdoc). */
export function buildDocument(src: PlaygroundSource, run: string, parentOrigin: string): string {
  const imports = buildImportMap(src.imports);
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    // The bridge goes first so it also captures errors thrown by libraries.
    `<script>(${installBridge.toString()})(${JSON.stringify(run)}, ${JSON.stringify(parentOrigin)}, ${serialize.toString()});</script>`,
    Object.keys(imports).length > 0
      ? `<script type="importmap">${inScript(JSON.stringify({ imports }))}</script>`
      : null,
    ...src.libraries.map((l) =>
      l.kind === "style" ? `<link rel="stylesheet" href="${attr(l.url)}">` : `<script src="${attr(l.url)}"></script>`,
    ),
    src.css.trim() ? `<style>\n${inStyle(src.css)}\n</style>` : null,
  ].filter(Boolean);
  const script = src.js.trim() ? `<script${src.module ? ' type="module"' : ""}>\n${inScript(src.js)}\n</script>` : "";
  return `<!doctype html>\n<html>\n<head>\n${head.join("\n")}\n</head>\n<body>\n${src.html}\n${script}\n</body>\n</html>\n`;
}

/** Whether the JS uses static imports and therefore needs module mode. */
export const usesImports = (js: string) => /^\s*import\s[\s\S]*?from\s*["']|^\s*import\s*["']/m.test(js);
