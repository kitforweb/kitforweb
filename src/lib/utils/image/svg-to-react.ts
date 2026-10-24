import { parseDocument } from "htmlparser2";
import type { ChildNode, Element } from "domhandler";
import { jsxAttributeName, styleToObject } from "../text/html-to-jsx";

export interface SvgToReactOptions {
  /** Component name (PascalCase). */
  name: string;
  typescript: boolean;
  /** Replace fill/stroke colors with currentColor so the icon follows the text color. */
  currentColor: boolean;
  /** Expose a `size` prop that sets width and height. */
  sizeProp: boolean;
  /** Keep the SVG's own width/height when there is no size prop. */
  memo: boolean;
}

export const DEFAULT_REACT_OPTIONS: SvgToReactOptions = {
  name: "Icon",
  typescript: true,
  currentColor: true,
  sizeProp: true,
  memo: false,
};

export type SvgToReactResult =
  { ok: true; output: string; colors: string[] } | { ok: false; error: "not-svg" | "name" };

const PAINT = new Set(["fill", "stroke", "stop-color", "flood-color", "lighting-color"]);
const KEEP = new Set(["none", "currentcolor", "transparent", "inherit"]);

function attributes(el: Element, options: SvgToReactOptions, colors: Set<string>, root: boolean): string[] {
  const out: string[] = [];
  for (const [raw, value] of Object.entries(el.attribs)) {
    const lower = raw.toLowerCase();
    // Root width/height are replaced by the size prop; xmlns:xlink is not needed in JSX.
    if (root && options.sizeProp && (lower === "width" || lower === "height")) continue;
    if (lower === "xmlns:xlink") continue;
    let v = value;
    if (PAINT.has(lower) && !KEEP.has(v.trim().toLowerCase()) && !v.startsWith("url(")) {
      colors.add(v.trim().toLowerCase());
      if (options.currentColor) v = "currentColor";
    }
    const name = jsxAttributeName(raw);
    if (name === "style") {
      let css = value;
      if (options.currentColor)
        css = css.replace(/\b(fill|stroke)\s*:\s*([^;]+)/gi, (m, prop: string, color: string) => {
          if (KEEP.has(color.trim().toLowerCase()) || color.trim().startsWith("url(")) return m;
          colors.add(color.trim().toLowerCase());
          return `${prop}: currentColor`;
        });
      out.push(`style={${styleToObject(css)}}`);
    } else out.push(`${name}=${JSON.stringify(v)}`);
  }
  return out;
}

function render(node: ChildNode, depth: number, options: SvgToReactOptions, colors: Set<string>): string[] {
  const pad = "  ".repeat(depth);
  if (node.type === "text") {
    const t = node.data.replace(/\s+/g, " ").trim();
    return t ? [pad + t.replace(/[{}<>]/g, (c) => `{${JSON.stringify(c)}}`)] : [];
  }
  if (node.type !== "tag" && node.type !== "style" && node.type !== "script") return [];
  const el = node as Element;
  if (el.name === "script") return [];
  const root = depth === 2;
  const attrs = attributes(el, options, colors, root);
  if (root) {
    if (options.sizeProp) attrs.push("width={size}", "height={size}");
    attrs.push("{...props}");
  }
  const open = `<${el.name}${attrs.length ? " " + attrs.join(" ") : ""}`;
  if (el.name === "style") {
    const css = el.children.map((c) => ("data" in c ? c.data : "")).join("");
    return [`${pad}${open}>{\`${css.replace(/[`\\]/g, "\\$&")}\`}</${el.name}>`];
  }
  const children = el.children.flatMap((c) => render(c, depth + 1, options, colors));
  if (children.length === 0) return [`${pad}${open} />`];
  return [`${pad}${open}>`, ...children, `${pad}</${el.name}>`];
}

/** A React component (TSX or JSX) from an SVG, with size/color props. */
export function svgToReact(svg: string, options: SvgToReactOptions = DEFAULT_REACT_OPTIONS): SvgToReactResult {
  if (!/^[A-Z][A-Za-z0-9]*$/.test(options.name)) return { ok: false, error: "name" };
  const doc = parseDocument(svg, { xmlMode: true, decodeEntities: false });
  const root = doc.children.find((c): c is Element => c.type === "tag" && (c as Element).name === "svg");
  if (!root) return { ok: false, error: "not-svg" };
  const colors = new Set<string>();
  const body = render(root, 2, options, colors).join("\n");

  const ts = options.typescript;
  const props = ts
    ? options.sizeProp
      ? `{ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number | string }`
      : `props: SVGProps<SVGSVGElement>`
    : options.sizeProp
      ? `{ size = 24, ...props }`
      : `props`;
  const named = [options.memo ? "memo" : null, ts ? "type SVGProps" : null].filter(Boolean);
  const imports = named.length > 0 ? `import { ${named.join(", ")} } from "react";\n\n` : "";
  const fn = `function ${options.name}(${props}) {\n  return (\n${body}\n  );\n}`;
  const output = options.memo
    ? `${imports}${fn}\n\nexport default memo(${options.name});\n`
    : `${imports}export default ${fn}\n`;
  return { ok: true, output, colors: [...colors] };
}
