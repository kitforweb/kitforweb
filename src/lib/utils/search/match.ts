/** Lowercases and strips diacritics so "formatear" matches "fórmatear". */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** True when every word of `query` appears somewhere in `haystack`. */
export function matchesQuery(query: string, haystack: string[]): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = normalize(haystack.join(" "));
  return words.every((w) => text.includes(w));
}

/**
 * Relevance of a match for sorting (lower is better): 0 when the name starts
 * with the query, 1 when the name contains every word, 2 otherwise.
 */
export function matchRank(query: string, name: string): number {
  const q = normalize(query).trim();
  const n = normalize(name);
  if (!q) return 2;
  if (n.startsWith(q)) return 0;
  return q.split(/\s+/).every((w) => n.includes(w)) ? 1 : 2;
}
