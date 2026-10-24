import * as heModule from "he";

// `he` is a UMD bundle: depending on the bundler it arrives as the namespace or as `default`.
const he = ((heModule as unknown as { default?: typeof heModule }).default ?? heModule) as typeof heModule;

export type EntityStyle = "named" | "decimal" | "hex";

export interface EncodeEntitiesOptions {
  style: EntityStyle;
  /** Also encode every non-ASCII character (é, ñ, emoji), not only & < > " '. */
  nonAscii: boolean;
}

/** Encodes special characters as HTML entities. */
export function encodeEntities(text: string, { style, nonAscii }: EncodeEntitiesOptions): string {
  if (!nonAscii) {
    const map: Record<string, [string, string, string]> = {
      "&": ["&amp;", "&#38;", "&#x26;"],
      "<": ["&lt;", "&#60;", "&#x3C;"],
      ">": ["&gt;", "&#62;", "&#x3E;"],
      '"': ["&quot;", "&#34;", "&#x22;"],
      "'": ["&#39;", "&#39;", "&#x27;"],
    };
    const i = style === "named" ? 0 : style === "decimal" ? 1 : 2;
    return text.replace(/[&<>"']/g, (c) => map[c][i]);
  }
  return he.encode(text, {
    useNamedReferences: style === "named",
    decimal: style === "decimal",
    allowUnsafeSymbols: false,
  });
}

/** Decodes named (&amp;), decimal (&#233;) and hexadecimal (&#xE9;) entities. */
export function decodeEntities(text: string): string {
  return he.decode(text);
}
