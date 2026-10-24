import { parseDocument } from "htmlparser2";
import type { ChildNode, Element } from "domhandler";

/** HTML attribute names whose React name is not a simple dash → camelCase conversion. */
const ATTRIBUTE_NAMES: Record<string, string> = {
  class: "className",
  for: "htmlFor",
  tabindex: "tabIndex",
  readonly: "readOnly",
  maxlength: "maxLength",
  minlength: "minLength",
  colspan: "colSpan",
  rowspan: "rowSpan",
  cellpadding: "cellPadding",
  cellspacing: "cellSpacing",
  autocomplete: "autoComplete",
  autofocus: "autoFocus",
  autoplay: "autoPlay",
  contenteditable: "contentEditable",
  crossorigin: "crossOrigin",
  enctype: "encType",
  formaction: "formAction",
  frameborder: "frameBorder",
  allowfullscreen: "allowFullScreen",
  novalidate: "noValidate",
  playsinline: "playsInline",
  referrerpolicy: "referrerPolicy",
  spellcheck: "spellCheck",
  srcset: "srcSet",
  srcdoc: "srcDoc",
  srclang: "srcLang",
  usemap: "useMap",
  datetime: "dateTime",
  accesskey: "accessKey",
  inputmode: "inputMode",
  enterkeyhint: "enterKeyHint",
  itemprop: "itemProp",
  itemscope: "itemScope",
  itemtype: "itemType",
  charset: "charSet",
  "accept-charset": "acceptCharset",
  "http-equiv": "httpEquiv",
  "xlink:href": "xlinkHref",
  "xml:lang": "xmlLang",
  "xml:space": "xmlSpace",
  "xmlns:xlink": "xmlnsXlink",
  viewbox: "viewBox",
  preserveaspectratio: "preserveAspectRatio",
};

/** Attributes that React expects as {true} when present without value. */
const BOOLEAN_ATTRIBUTES = new Set([
  "allowFullScreen",
  "async",
  "autoFocus",
  "autoPlay",
  "checked",
  "controls",
  "default",
  "defer",
  "disabled",
  "formNoValidate",
  "hidden",
  "itemScope",
  "loop",
  "multiple",
  "muted",
  "noValidate",
  "open",
  "playsInline",
  "readOnly",
  "required",
  "reversed",
  "selected",
]);

const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

export interface HtmlToJsxOptions {
  /** Wrap the result in `export default function <name>() { return (…) }`. */
  component?: string;
  /** Turn value/checked on form fields into defaultValue/defaultChecked (uncontrolled). */
  uncontrolled?: boolean;
  indent?: number;
}

export type HtmlToJsxResult = { ok: true; output: string; warnings: string[] } | { ok: false; error: "empty" };

const camel = (s: string) => s.replace(/[-:]([a-z])/g, (_, c: string) => c.toUpperCase());

/** React name of an HTML attribute. */
export function jsxAttributeName(name: string): string {
  const lower = name.toLowerCase();
  if (ATTRIBUTE_NAMES[lower]) return ATTRIBUTE_NAMES[lower];
  if (lower.startsWith("data-") || lower.startsWith("aria-")) return lower;
  if (/^on[a-z]+$/.test(lower)) return `on${lower[2].toUpperCase()}${lower.slice(3)}`;
  // SVG presentation attributes (stroke-width) and anything else with dashes.
  return name.includes("-") || name.includes(":") ? camel(lower) : name;
}

/** "color: red; margin-top: 4px" → `{ color: "red", marginTop: "4px" }`. */
export function styleToObject(style: string): string {
  const entries: string[] = [];
  // Split on ; outside parentheses (url(data:…;base64,…)).
  let depth = 0;
  let current = "";
  const decls: string[] = [];
  for (const ch of style) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === ";" && depth === 0) {
      decls.push(current);
      current = "";
    } else current += ch;
  }
  decls.push(current);
  for (const decl of decls) {
    const at = decl.indexOf(":");
    if (at < 0) continue;
    const prop = decl.slice(0, at).trim();
    const value = decl.slice(at + 1).trim();
    if (!prop || !value) continue;
    const key = prop.startsWith("--")
      ? JSON.stringify(prop)
      : prop
          .toLowerCase()
          .replace(/^-ms-/, "ms-")
          .replace(/^-(webkit|moz|o)-/, (_, v: string) => `${v[0].toUpperCase()}${v.slice(1)}-`)
          .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    const numeric =
      /^-?\d+(\.\d+)?$/.test(value) &&
      /^(opacity|zIndex|flex|flexGrow|flexShrink|fontWeight|lineHeight|order|zoom)$/.test(key);
    entries.push(`${key}: ${numeric ? value : JSON.stringify(value)}`);
  }
  return entries.length === 0 ? "{}" : `{ ${entries.join(", ")} }`;
}

const escapeText = (text: string) => text.replace(/[{}]/g, (c) => `{"${c}"}`).replace(/>/g, "&gt;");

const attrString = (value: string) =>
  value.includes('"') || value.includes("\n") || value.includes("\\") ? `{${JSON.stringify(value)}}` : `"${value}"`;

function attributes(el: Element, options: HtmlToJsxOptions, warnings: Set<string>): string[] {
  const out: string[] = [];
  const formField = ["input", "textarea", "select"].includes(el.name.toLowerCase());
  for (const [rawName, value] of Object.entries(el.attribs)) {
    let name = jsxAttributeName(rawName);
    if (options.uncontrolled && formField && (name === "value" || name === "checked")) {
      name = name === "value" ? "defaultValue" : "defaultChecked";
    }
    if (name === "style") {
      out.push(`style={${styleToObject(value)}}`);
    } else if (/^on[A-Z]/.test(name)) {
      warnings.add("event-handlers");
      out.push(`${name}={() => { ${value.trim().replace(/;$/, "")} }}`);
    } else if (value === "" && (BOOLEAN_ATTRIBUTES.has(name) || name === "defaultChecked")) {
      out.push(name);
    } else {
      out.push(`${name}=${attrString(value)}`);
    }
  }
  return out;
}

function render(
  node: ChildNode,
  depth: number,
  options: HtmlToJsxOptions,
  warnings: Set<string>,
  pre: boolean,
): string[] {
  const pad = " ".repeat((options.indent ?? 2) * depth);
  switch (node.type) {
    case "text": {
      const raw = node.data;
      if (pre) return [`{${JSON.stringify(raw)}}`];
      const text = raw.replace(/\s+/g, " ").trim();
      return text ? [pad + escapeText(text)] : [];
    }
    case "comment":
      return [`${pad}{/* ${node.data.trim().replace(/\*\//g, "* /")} */}`];
    case "directive":
      return [];
    case "cdata":
      return node.children.flatMap((c) => render(c, depth, options, warnings, pre));
    case "script":
    case "style":
    case "tag": {
      const el = node as Element;
      const tag = el.name;
      const attrs = attributes(el, options, warnings);
      if (tag.toLowerCase() === "script") warnings.add("script");
      const open = attrs.length > 0 ? `<${tag} ${attrs.join(" ")}` : `<${tag}`;
      // Raw text elements: their content goes through as a template literal.
      if (["script", "style"].includes(tag.toLowerCase())) {
        const content = el.children.map((c) => ("data" in c ? c.data : "")).join("");
        if (!content.trim()) return [`${pad}${open} />`];
        return [`${pad}${open}>{\`${content.replace(/[`\\]/g, "\\$&").replace(/\$\{/g, "\\${")}\`}</${tag}>`];
      }
      if (tag.toLowerCase() === "textarea" && el.children.length > 0) {
        const content = el.children.map((c) => ("data" in c ? c.data : "")).join("");
        return [`${pad}${open} defaultValue={${JSON.stringify(content)}} />`];
      }
      if (VOID.has(tag.toLowerCase()) || el.children.length === 0) return [`${pad}${open} />`];
      const isPre = pre || tag.toLowerCase() === "pre";
      if (isPre) {
        const inner = el.children.flatMap((c) => render(c, 0, options, warnings, true)).join("");
        return [`${pad}${open}>${inner}</${tag}>`];
      }
      const children = el.children.flatMap((c) => render(c, depth + 1, options, warnings, false));
      if (children.length === 0) return [`${pad}${open} />`];
      // Short, single-text children stay on one line: <p>Hello</p>.
      if (
        children.length === 1 &&
        el.children.length === 1 &&
        el.children[0].type === "text" &&
        children[0].trim().length < 60
      ) {
        return [`${pad}${open}>${children[0].trim()}</${tag}>`];
      }
      return [`${pad}${open}>`, ...children, `${pad}</${tag}>`];
    }
    default:
      return [];
  }
}

export function htmlToJsx(html: string, options: HtmlToJsxOptions = {}): HtmlToJsxResult {
  if (!html.trim()) return { ok: false, error: "empty" };
  const doc = parseDocument(html, {
    decodeEntities: false,
    lowerCaseAttributeNames: false,
    lowerCaseTags: false,
    recognizeSelfClosing: true,
  });
  const warnings = new Set<string>();
  const roots = doc.children.filter((c) => !(c.type === "text" && !c.data.trim()) && c.type !== "directive");
  const multiple = roots.length > 1;
  const base = options.component ? (multiple ? 3 : 2) : multiple ? 1 : 0;
  let lines = roots.flatMap((r) => render(r, base, options, warnings, false));
  if (multiple) {
    const pad = " ".repeat((options.indent ?? 2) * (base - 1));
    lines = [`${pad}<>`, ...lines, `${pad}</>`];
  }
  let output = lines.join("\n");
  if (options.component) {
    const pad = " ".repeat(options.indent ?? 2);
    output = `export default function ${options.component}() {\n${pad}return (\n${output}\n${pad});\n}`;
  }
  return { ok: true, output: output + "\n", warnings: [...warnings] };
}
