/**
 * Splits a shell command into arguments like bash would: single and double
 * quotes, $'…' ANSI-C strings, backslash escapes and line continuations
 * (also Windows cmd ^ continuations from "Copy as cURL (cmd)").
 */
export function tokenize(command: string): string[] | null {
  const text = command
    .replace(/\\\r?\n/g, " ")
    .replace(/\^\r?\n/g, " ")
    .replace(/\^(["^&|<>])/g, "$1");
  const out: string[] = [];
  let cur = "";
  let has = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (/\s/.test(c)) {
      if (has) out.push(cur);
      cur = "";
      has = false;
      i++;
    } else if (c === "'") {
      const end = text.indexOf("'", i + 1);
      if (end < 0) return null;
      cur += text.slice(i + 1, end);
      has = true;
      i = end + 1;
    } else if (c === "$" && text[i + 1] === "'") {
      let j = i + 2;
      let s = "";
      while (j < text.length && text[j] !== "'") {
        if (text[j] === "\\" && j + 1 < text.length) {
          const n = text[j + 1];
          s += n === "n" ? "\n" : n === "t" ? "\t" : n === "r" ? "\r" : n;
          j += 2;
        } else s += text[j++];
      }
      if (j >= text.length) return null;
      cur += s;
      has = true;
      i = j + 1;
    } else if (c === '"') {
      let j = i + 1;
      let s = "";
      while (j < text.length && text[j] !== '"') {
        if (text[j] === "\\" && j + 1 < text.length && /["\\$`]/.test(text[j + 1])) {
          s += text[j + 1];
          j += 2;
        } else s += text[j++];
      }
      if (j >= text.length) return null;
      cur += s;
      has = true;
      i = j + 1;
    } else if (c === "\\" && i + 1 < text.length) {
      cur += text[i + 1];
      has = true;
      i += 2;
    } else {
      cur += c;
      has = true;
      i++;
    }
  }
  if (has) out.push(cur);
  return out;
}
