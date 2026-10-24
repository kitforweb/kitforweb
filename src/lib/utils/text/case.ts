import {
  camelCase,
  capitalCase,
  constantCase,
  dotCase,
  kebabCase,
  pascalCase,
  pathCase,
  sentenceCase,
  snakeCase,
  trainCase,
} from "change-case";
import type { CaseStyle } from "./case-style";

export { detectCase } from "./case-style";

export { caseStyles, type CaseStyle } from "./case-style";

/** Example identifier shown next to each style. */
export const CASE_LABELS: Record<CaseStyle, string> = {
  camel: "camelCase",
  pascal: "PascalCase",
  snake: "snake_case",
  kebab: "kebab-case",
  constant: "CONSTANT_CASE",
  title: "Title Case",
  sentence: "Sentence case",
  dot: "dot.case",
  path: "path/case",
  train: "Train-Case",
  lower: "lower case",
  upper: "UPPER CASE",
};

// Accents are letters too: "año_fiscal" must stay one word, not "a" + "o".
const OPTIONS = { prefixCharacters: "_$", suffixCharacters: "" };

function convertOne(text: string, style: CaseStyle): string {
  switch (style) {
    case "camel":
      return camelCase(text, OPTIONS);
    case "pascal":
      return pascalCase(text, OPTIONS);
    case "snake":
      return snakeCase(text, OPTIONS);
    case "kebab":
      return kebabCase(text, OPTIONS);
    case "constant":
      return constantCase(text, OPTIONS);
    case "title":
      return capitalCase(text, OPTIONS);
    case "sentence":
      return sentenceCase(text, OPTIONS);
    case "dot":
      return dotCase(text, OPTIONS);
    case "path":
      return pathCase(text, OPTIONS);
    case "train":
      return trainCase(text, OPTIONS);
    case "lower":
      return capitalCase(text, OPTIONS).toLowerCase();
    case "upper":
      return capitalCase(text, OPTIONS).toUpperCase();
  }
}

/** Converts every line of `text` to `style`; empty lines stay empty. */
export function convertCase(text: string, style: CaseStyle): string {
  return text
    .split(/\r?\n/)
    .map((line) => (line.trim() === "" ? "" : convertOne(line.trim(), style)))
    .join("\n");
}
