/** Case styles, and detection of the style an identifier is written in (no dependencies, used by the Home detector). */
export const caseStyles = [
  "camel",
  "pascal",
  "snake",
  "kebab",
  "constant",
  "title",
  "sentence",
  "dot",
  "path",
  "train",
  "lower",
  "upper",
] as const;
export type CaseStyle = (typeof caseStyles)[number];

/** Best guess of the style an identifier is written in, or null for free text. */
export function detectCase(identifier: string): CaseStyle | null {
  const t = identifier.trim();
  if (/^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)+$/.test(t)) return "camel";
  if (/^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+$/.test(t)) return "pascal";
  if (/^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(t)) return "snake";
  if (/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(t)) return "constant";
  if (/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(t)) return "kebab";
  if (/^[A-Z][a-z0-9]*(?:-[A-Z][a-z0-9]*)+$/.test(t)) return "train";
  if (/^[a-z][a-z0-9]*(?:\.[a-z0-9]+)+$/.test(t)) return "dot";
  return null;
}
