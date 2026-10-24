import { XMLBuilder, XMLParser, XMLValidator } from "fast-xml-parser";
import { fail, ok, type ConvertResult } from "../convert/result";
import { parseJsonStrict } from "../json/parse";

export type XmlCheck = { ok: true } | { ok: false; error: string; line: number; column: number };

export function validateXml(xml: string): XmlCheck {
  const r = XMLValidator.validate(xml, { allowBooleanAttributes: true });
  return r === true ? { ok: true } : { ok: false, error: r.err.msg, line: r.err.line, column: r.err.col };
}

export interface XmlJsonOptions {
  /** Prefix for attributes in JSON ("@_" → { "@_id": "7" }). */
  attributePrefix: string;
  /** Convert "42" and "true" to numbers and booleans. */
  parseValues: boolean;
}

export function xmlToJson(xml: string, { attributePrefix, parseValues }: XmlJsonOptions): ConvertResult {
  const check = validateXml(xml);
  if (!check.ok) return fail(check.error, check.line, check.column);
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: attributePrefix,
    textNodeName: "#text",
    parseTagValue: parseValues,
    parseAttributeValue: parseValues,
    allowBooleanAttributes: true,
    ignoreDeclaration: true,
    cdataPropName: "#cdata",
    commentPropName: "#comment",
  });
  return ok(JSON.stringify(parser.parse(xml), null, 2));
}

export function jsonToXml(
  json: string,
  { attributePrefix }: Pick<XmlJsonOptions, "attributePrefix">,
  indent = 2,
): ConvertResult {
  const parsed = parseJsonStrict(json);
  if (!parsed.ok) return parsed.result;
  const value = parsed.value;
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return fail("The JSON must be an object (its keys become the root elements).");
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: attributePrefix,
    textNodeName: "#text",
    cdataPropName: "#cdata",
    commentPropName: "#comment",
    format: true,
    indentBy: " ".repeat(indent),
    suppressEmptyNode: true,
  });
  const keys = Object.keys(value);
  const body = String(builder.build(value)).trim();
  const warnings =
    keys.length > 1 ? ["An XML document needs a single root element; the JSON has several top-level keys."] : undefined;
  return ok(`<?xml version="1.0" encoding="UTF-8"?>\n${body}\n`, warnings);
}

type Token =
  | { kind: "open"; text: string; name: string; selfClosing: boolean }
  | { kind: "close"; text: string; name: string }
  | { kind: "text"; text: string }
  | { kind: "other"; text: string }; // declaration, comment, CDATA, doctype, processing instruction

function tokenize(xml: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < xml.length) {
    if (xml.startsWith("<!--", i)) {
      const end = xml.indexOf("-->", i);
      tokens.push({ kind: "other", text: xml.slice(i, end + 3) });
      i = end + 3;
    } else if (xml.startsWith("<![CDATA[", i)) {
      const end = xml.indexOf("]]>", i);
      tokens.push({ kind: "other", text: xml.slice(i, end + 3) });
      i = end + 3;
    } else if (xml.startsWith("<?", i) || xml.startsWith("<!", i)) {
      const end = xml.indexOf(">", i);
      tokens.push({ kind: "other", text: xml.slice(i, end + 1) });
      i = end + 1;
    } else if (xml[i] === "<") {
      // Find the closing ">" outside attribute quotes.
      let j = i + 1;
      let quote: string | null = null;
      for (; j < xml.length; j++) {
        if (quote) {
          if (xml[j] === quote) quote = null;
        } else if (xml[j] === '"' || xml[j] === "'") quote = xml[j];
        else if (xml[j] === ">") break;
      }
      const text = xml
        .slice(i, j + 1)
        .replace(/\s+/g, " ")
        .replace(/\s+(\/?>)$/, "$1");
      const name = /^<\/?\s*([^\s/>]+)/.exec(text)?.[1] ?? "";
      if (text.startsWith("</")) tokens.push({ kind: "close", text, name });
      else tokens.push({ kind: "open", text, name, selfClosing: text.endsWith("/>") });
      i = j + 1;
    } else {
      const end = xml.indexOf("<", i);
      const text = xml.slice(i, end < 0 ? xml.length : end);
      if (text.trim()) tokens.push({ kind: "text", text: text.trim() });
      i = end < 0 ? xml.length : end;
    }
  }
  return tokens;
}

/** Re-indents XML. Elements that only contain text stay on one line. Comments and CDATA are kept. */
export function formatXml(xml: string, indent = 2): ConvertResult {
  const check = validateXml(xml);
  if (!check.ok) return fail(check.error, check.line, check.column);
  const tokens = tokenize(xml.trim());
  const pad = (d: number) => " ".repeat(indent * d);
  const lines: string[] = [];
  let depth = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind === "open" && !t.selfClosing) {
      const next = tokens[i + 1];
      const after = tokens[i + 2];
      if (next?.kind === "text" && after?.kind === "close" && after.name === t.name) {
        lines.push(pad(depth) + t.text + next.text + after.text);
        i += 2;
        continue;
      }
      if (next?.kind === "close" && next.name === t.name) {
        lines.push(pad(depth) + t.text + next.text);
        i += 1;
        continue;
      }
      lines.push(pad(depth) + t.text);
      depth++;
    } else if (t.kind === "close") {
      depth = Math.max(0, depth - 1);
      lines.push(pad(depth) + t.text);
    } else {
      lines.push(pad(depth) + t.text);
    }
  }
  return ok(lines.join("\n") + "\n");
}

/** Removes indentation and comments; keeps text and CDATA. */
export function minifyXml(xml: string, keepComments = false): ConvertResult {
  const check = validateXml(xml);
  if (!check.ok) return fail(check.error, check.line, check.column);
  return ok(
    tokenize(xml.trim())
      .filter((t) => keepComments || !t.text.startsWith("<!--"))
      .map((t) => t.text)
      .join(""),
  );
}
