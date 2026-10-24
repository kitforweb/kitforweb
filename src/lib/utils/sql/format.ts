import { format, type SqlLanguage } from "sql-formatter";
import { errorMessage, fail, ok, type ConvertResult } from "../convert/result";

export const SQL_DIALECTS = [
  "sql",
  "postgresql",
  "mysql",
  "mariadb",
  "tsql",
  "sqlite",
  "plsql",
  "bigquery",
  "snowflake",
] as const;
export type SqlDialect = (typeof SQL_DIALECTS)[number];

export interface SqlFormatOptions {
  dialect: SqlDialect;
  keywordCase: "upper" | "lower" | "preserve";
  indent: 2 | 4;
}

/** Pretty-prints SQL: keywords in upper case, one clause per line. */
export function formatSql(sql: string, { dialect, keywordCase, indent }: SqlFormatOptions): ConvertResult {
  try {
    return ok(format(sql, { language: dialect as SqlLanguage, keywordCase, tabWidth: indent, linesBetweenQueries: 2 }));
  } catch (e) {
    const msg = errorMessage(e);
    const m = /line (\d+) column (\d+)/i.exec(msg);
    return fail(msg.split("\n")[0], m ? Number(m[1]) : undefined, m ? Number(m[2]) : undefined);
  }
}

/**
 * Collapses a query onto one line: removes comments and extra whitespace,
 * keeping string literals and quoted identifiers intact.
 */
export function minifySql(sql: string): string {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    const next = sql[i + 1];
    if (c === "'" || c === '"' || c === "`") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === c && sql[j + 1] === c)
          j += 2; // escaped quote ('' or "")
        else if (sql[j] === c) break;
        else j++;
      }
      out += sql.slice(i, j + 1);
      i = j + 1;
    } else if (c === "-" && next === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
    } else if (c === "/" && next === "*") {
      const end = sql.indexOf("*/", i + 2);
      i = end < 0 ? sql.length : end + 2;
    } else if (/\s/.test(c)) {
      if (out && !/\s$/.test(out)) out += " ";
      while (i < sql.length && /\s/.test(sql[i])) i++;
    } else {
      out += c;
      i++;
    }
  }
  // No spaces right inside parentheses or before commas and semicolons.
  return out
    .replace(/\(\s+/g, "(")
    .replace(/\s+([),;])/g, "$1")
    .trim();
}
