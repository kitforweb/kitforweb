/** "my root-type" → "MyRootType"; falls back to "Root". */
export function toTypeName(name: string): string {
  const pascal = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join("")
    .replace(/^\d+/, "");
  return pascal ? pascal[0].toUpperCase() + pascal.slice(1) : "Root";
}
