"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { ConverterTool } from "@/components/shared/converter-tool";
import { Segmented, ToolbarSelect } from "@/components/shared/toolbar-controls";
import { ok } from "@/lib/utils/convert/result";
import { formatSql, minifySql, SQL_DIALECTS, type SqlDialect } from "@/lib/utils/sql/format";

const EXAMPLE = `select u.id, u.email, count(o.id) as orders, sum(o.total) as spent from users u left join orders o on o.user_id = u.id and o.status in ('paid','shipped') where u.created_at >= '2024-01-01' and u.deleted_at is null group by u.id, u.email having count(o.id) > 2 order by spent desc limit 20;`;

const DIALECT_LABEL: Record<SqlDialect, string> = {
  sql: "Standard SQL",
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  mariadb: "MariaDB",
  tsql: "SQL Server",
  sqlite: "SQLite",
  plsql: "Oracle PL/SQL",
  bigquery: "BigQuery",
  snowflake: "Snowflake",
};

export default function SqlFormatter() {
  const t = useTranslations("tools.sql-formatter");
  const [mode, setMode] = useState<"format" | "minify">("format");
  const [dialect, setDialect] = useState<SqlDialect>("postgresql");
  const [keywordCase, setKeywordCase] = useState<"upper" | "lower" | "preserve">("upper");
  const [indent, setIndent] = useState<"2" | "4">("2");

  const convert = useCallback(
    (sql: string) =>
      mode === "minify"
        ? ok(minifySql(sql))
        : formatSql(sql, { dialect, keywordCase, indent: Number(indent) as 2 | 4 }),
    [mode, dialect, keywordCase, indent],
  );

  return (
    <ConverterTool
      toolId="sql-formatter"
      directions={[
        {
          input: { label: "query.sql", language: "sql" },
          output: { label: mode === "minify" ? "query.min.sql" : "formatted.sql", language: "sql" },
        },
      ]}
      convert={convert}
      example={EXAMPLE}
      placeholder={t("placeholder")}
      fileAccept=".sql,text/plain"
      wrapOutput={mode === "minify"}
      toolbar={
        <>
          <Segmented
            label={t("mode")}
            value={mode}
            onChange={setMode}
            options={[
              { value: "format", label: t("format") },
              { value: "minify", label: t("minify") },
            ]}
          />
          {mode === "format" && (
            <>
              <ToolbarSelect
                label={t("dialect")}
                value={dialect}
                onChange={setDialect}
                options={SQL_DIALECTS.map((d) => ({ value: d, label: DIALECT_LABEL[d] }))}
              />
              <ToolbarSelect
                label={t("keywordCase")}
                value={keywordCase}
                onChange={setKeywordCase}
                options={[
                  { value: "upper", label: "SELECT" },
                  { value: "lower", label: "select" },
                  { value: "preserve", label: t("preserve") },
                ]}
              />
              <ToolbarSelect
                label={t("indent")}
                value={indent}
                onChange={setIndent}
                options={[
                  { value: "2", label: t("spaces", { n: 2 }) },
                  { value: "4", label: t("spaces", { n: 4 }) },
                ]}
              />
            </>
          )}
        </>
      }
    />
  );
}
