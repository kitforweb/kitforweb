/** The fields of a KeyboardEvent this tool shows (a plain object, so it can be tested without a DOM). */
export interface KeyInfo {
  key: string;
  code: string;
  keyCode: number;
  location: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  repeat: boolean;
}

export type KeyLocation = "standard" | "left" | "right" | "numpad";

export const LOCATIONS: readonly KeyLocation[] = ["standard", "left", "right", "numpad"];

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta", "AltGraph", "OS"]);

/** Readable name for keys whose `key` is invisible or ambiguous. */
export function keyLabel(key: string): string {
  if (key === " ") return "Space";
  if (key.length === 1) return key.toUpperCase();
  return key;
}

/** "Ctrl+Shift+K" in the conventional order Ctrl, Alt, Shift, Meta. */
export function combo(e: KeyInfo, mac = false): string {
  const parts: string[] = [];
  if (e.ctrlKey && e.key !== "Control") parts.push("Ctrl");
  if (e.altKey && e.key !== "Alt") parts.push(mac ? "Option" : "Alt");
  if (e.shiftKey && e.key !== "Shift") parts.push("Shift");
  if (e.metaKey && e.key !== "Meta") parts.push(mac ? "Cmd" : "Meta");
  parts.push(keyLabel(e.key));
  return parts.join("+");
}

export const isModifier = (key: string) => MODIFIER_KEYS.has(key);

/**
 * A condition that matches this shortcut in a keydown handler. It compares
 * `key` for printable characters (layout-aware) and `code` otherwise.
 */
export function shortcutCondition(e: KeyInfo): string {
  const conds: string[] = [];
  if (isModifier(e.key)) return `event.key === ${JSON.stringify(e.key)}`;
  // With Shift, a letter's key is upper case: compare it case-insensitively.
  conds.push(
    e.key.length === 1 && /[a-z]/i.test(e.key)
      ? `event.key.toLowerCase() === ${JSON.stringify(e.key.toLowerCase())}`
      : e.key.length === 1
        ? `event.code === ${JSON.stringify(e.code)}`
        : `event.key === ${JSON.stringify(e.key)}`,
  );
  if (e.ctrlKey) conds.push("event.ctrlKey");
  if (e.altKey) conds.push("event.altKey");
  if (e.shiftKey) conds.push("event.shiftKey");
  if (e.metaKey) conds.push("event.metaKey");
  return conds.join(" && ");
}

/** A ready-to-paste listener for the shortcut. */
export function shortcutSnippet(e: KeyInfo): string {
  return [
    'window.addEventListener("keydown", (event) => {',
    `  if (${shortcutCondition(e)}) {`,
    "    event.preventDefault();",
    "    // …",
    "  }",
    "});",
  ].join("\n");
}

export function locationName(location: number): KeyLocation {
  return LOCATIONS[location] ?? "standard";
}
