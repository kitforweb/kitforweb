export interface Column {
  name: string;
  type: string;
  pk: boolean;
  fk: boolean;
  notNull: boolean;
  unique: boolean;
}

export interface Table {
  name: string;
  columns: Column[];
}

export interface Relation {
  /** Table that holds the foreign key (the "many" side). */
  from: string;
  fromColumns: string[];
  /** Referenced table (the "one" side). */
  to: string;
  toColumns: string[];
  /** One-to-one when the FK columns are unique or the primary key. */
  oneToOne: boolean;
  optional: boolean;
}

export interface Schema {
  tables: Table[];
  relations: Relation[];
}

/** Removes `"`, `` ` `` and `[ ]` quoting and the schema prefix (public.users → users). */
export function unquote(identifier: string): string {
  const parts = identifier
    .trim()
    .split(".")
    .map((p) => p.trim().replace(/^["`[]|["`\]]$/g, ""));
  return parts[parts.length - 1];
}

/** Splits on commas that are not inside parentheses or quotes. */
function splitTopLevel(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let cur = "";
  for (const c of text) {
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === "'" || c === '"' || c === "`") quote = c;
    else if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const IDENT = String.raw`(?:"[^"]+"|\x60[^\x60]+\x60|\[[^\]]+\]|[\w$]+)(?:\s*\.\s*(?:"[^"]+"|\x60[^\x60]+\x60|\[[^\]]+\]|[\w$]+))?`;
const columnList = (s: string) => s.split(",").map(unquote).filter(Boolean);

function stripComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Body of a CREATE TABLE: everything between its outer parentheses. */
function tableBodies(sql: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const re = new RegExp(
    String.raw`create\s+(?:or\s+replace\s+)?(?:temp(?:orary)?\s+)?table\s+(?:if\s+not\s+exists\s+)?(${IDENT})\s*\(`,
    "gi",
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    let depth = 1;
    let i = re.lastIndex;
    for (; i < sql.length && depth > 0; i++) {
      if (sql[i] === "(") depth++;
      else if (sql[i] === ")") depth--;
    }
    out.push({ name: unquote(m[1]), body: sql.slice(re.lastIndex, i - 1) });
    re.lastIndex = i;
  }
  return out;
}

/** Parses CREATE TABLE (and ALTER TABLE … FOREIGN KEY) statements into tables and relations. */
export function parseSchema(input: string): Schema {
  const sql = stripComments(input);
  const tables: Table[] = [];
  const fks: Omit<Relation, "oneToOne" | "optional">[] = [];

  for (const { name, body } of tableBodies(sql)) {
    const table: Table = { name, columns: [] };
    const tablePk: string[] = [];
    const tableUnique: string[][] = [];
    for (const part of splitTopLevel(body)) {
      const pk = /^(?:constraint\s+\S+\s+)?primary\s+key\s*\(([^)]+)\)/i.exec(part);
      const fk = new RegExp(
        String.raw`^(?:constraint\s+\S+\s+)?foreign\s+key\s*\(([^)]+)\)\s*references\s+(${IDENT})\s*(?:\(([^)]+)\))?`,
        "i",
      ).exec(part);
      const uq = /^(?:constraint\s+\S+\s+)?unique(?:\s+key)?(?:\s+\S+)?\s*\(([^)]+)\)/i.exec(part);
      if (pk) tablePk.push(...columnList(pk[1]));
      else if (fk)
        fks.push({
          from: name,
          fromColumns: columnList(fk[1]),
          to: unquote(fk[2]),
          toColumns: fk[3] ? columnList(fk[3]) : [],
        });
      else if (uq) tableUnique.push(columnList(uq[1]));
      else if (/^(constraint|check|index|key|fulltext|spatial|exclude)\b/i.test(part)) continue;
      else {
        const col = new RegExp(String.raw`^(${IDENT})\s+([\s\S]*)$`).exec(part);
        if (!col) continue;
        const rest = col[2];
        const type = (
          /^([\w ]+?(?:\([^)]*\))?(?:\[\])?)(?=\s+(?:not|null|primary|references|unique|default|check|constraint|generated|auto_increment|identity|collate|on|comment)\b|$)/i.exec(
            rest,
          )?.[1] ?? rest.split(/\s+/)[0]
        ).trim();
        const ref = new RegExp(String.raw`references\s+(${IDENT})\s*(?:\(([^)]+)\))?`, "i").exec(rest);
        const colName = unquote(col[1]);
        if (ref)
          fks.push({
            from: name,
            fromColumns: [colName],
            to: unquote(ref[1]),
            toColumns: ref[2] ? columnList(ref[2]) : [],
          });
        table.columns.push({
          name: colName,
          type,
          pk: /primary\s+key/i.test(rest),
          fk: Boolean(ref),
          notNull: /not\s+null/i.test(rest) || /primary\s+key/i.test(rest),
          unique: /\bunique\b/i.test(rest),
        });
      }
    }
    for (const c of table.columns) {
      if (tablePk.includes(c.name)) c.pk = c.notNull = true;
      if (tableUnique.some((u) => u.length === 1 && u[0] === c.name)) c.unique = true;
    }
    tables.push(table);
  }

  // ALTER TABLE x ADD [CONSTRAINT y] FOREIGN KEY (a) REFERENCES z (b)
  const alter = new RegExp(
    String.raw`alter\s+table\s+(?:only\s+)?(${IDENT})\s+add\s+(?:constraint\s+\S+\s+)?foreign\s+key\s*\(([^)]+)\)\s*references\s+(${IDENT})\s*(?:\(([^)]+)\))?`,
    "gi",
  );
  let a: RegExpExecArray | null;
  while ((a = alter.exec(sql)))
    fks.push({
      from: unquote(a[1]),
      fromColumns: columnList(a[2]),
      to: unquote(a[3]),
      toColumns: a[4] ? columnList(a[4]) : [],
    });

  const relations: Relation[] = fks.map((fk) => {
    const table = tables.find((t) => t.name === fk.from);
    const cols = table?.columns.filter((c) => fk.fromColumns.includes(c.name)) ?? [];
    cols.forEach((c) => (c.fk = true));
    const pkCols = table?.columns.filter((c) => c.pk).map((c) => c.name) ?? [];
    const oneToOne =
      (cols.length === 1 && cols[0].unique) ||
      (pkCols.length > 0 && pkCols.length === fk.fromColumns.length && pkCols.every((c) => fk.fromColumns.includes(c)));
    return { ...fk, oneToOne, optional: cols.some((c) => !c.notNull) };
  });

  return { tables, relations };
}

/** Mermaid only accepts simple names for entities and attribute types. */
const entity = (s: string) => s.replace(/[^\w-]/g, "_");
const attrType = (s: string) =>
  s
    .replace(/\s*,\s*/g, "-")
    .replace(/\s+/g, "_")
    .replace(/[^\w()[\]-]/g, "") || "unknown";

/** Mermaid erDiagram for the schema: each foreign key is a "many to one" (or one to one) line. */
export function toMermaidEr(schema: Schema): string {
  const lines = ["erDiagram"];
  for (const r of schema.relations) {
    const child = r.oneToOne ? (r.optional ? "o|" : "||") : r.optional ? "o{" : "|{";
    lines.push(`  ${entity(r.to)} ||--${child} ${entity(r.from)} : "${r.fromColumns.join(", ")}"`);
  }
  for (const t of schema.tables) {
    lines.push(`  ${entity(t.name)} {`);
    for (const c of t.columns) {
      const keys = [c.pk && "PK", c.fk && "FK", !c.pk && c.unique && "UK"].filter(Boolean).join(", ");
      lines.push(
        `    ${attrType(c.type)} ${entity(c.name)}${keys ? ` ${keys}` : ""}${!c.notNull && !c.pk ? ' "nullable"' : ""}`,
      );
    }
    lines.push("  }");
  }
  return lines.join("\n");
}
