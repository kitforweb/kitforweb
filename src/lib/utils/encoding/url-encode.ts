import { fail, ok, type ConvertResult } from "../convert/result";

export interface UrlEncodings {
  /** encodeURIComponent: for a single value (query value, path segment). */
  component: string;
  /** encodeURI: for a whole URL; keeps : / ? # & = intact. */
  uri: string;
  /** application/x-www-form-urlencoded: like component, but spaces become "+". */
  form: string;
}

export function urlEncodeAll(text: string): UrlEncodings {
  const component = encodeURIComponent(text);
  return {
    component,
    uri: encodeURI(text),
    form: new URLSearchParams([["", text]]).toString().slice(1),
  };
}

/** Decodes percent-encoding. With `plusAsSpace`, "+" is read as a space (form data). */
export function urlDecode(text: string, plusAsSpace = false): ConvertResult {
  const input = plusAsSpace ? text.replace(/\+/g, " ") : text;
  try {
    return ok(decodeURIComponent(input));
  } catch {
    const bad = /%(?![0-9a-f]{2})|%[0-9a-f]{2}/gi;
    // Locate the first sequence that cannot be decoded on its own.
    let match: RegExpExecArray | null;
    while ((match = bad.exec(input))) {
      try {
        decodeURIComponent(input.slice(match.index, match.index + 12).replace(/%(?![0-9a-f]{2})/gi, "%25"));
      } catch {
        return fail(
          `Malformed percent-encoding near "${input.slice(match.index, match.index + 9)}"`,
          1,
          match.index + 1,
        );
      }
      if (!/^%[0-9a-f]{2}$/i.test(match[0])) {
        return fail(`"%" must be followed by two hexadecimal digits`, 1, match.index + 1);
      }
    }
    return fail("Malformed percent-encoding (invalid UTF-8 sequence)");
  }
}
