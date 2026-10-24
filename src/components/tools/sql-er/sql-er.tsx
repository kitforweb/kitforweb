"use client";

import { useMemo, useState } from "react";
import { CircleAlert, Download, ExternalLink, ImageDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { CodeEditor } from "@/components/shared/code-editor";
import { FileDrop, FileOpenButton } from "@/components/shared/file-drop";
import { ToolShell } from "@/components/shared/tool-shell";
import { Segmented } from "@/components/shared/toolbar-controls";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAppLocale } from "@/hooks/use-app-locale";
import { useDebounced } from "@/hooks/use-debounced";
import { useMermaid } from "@/hooks/use-mermaid";
import { useToolInput } from "@/hooks/use-tool-input";
import { downloadBlob } from "@/lib/download";
import { toolPath } from "@/lib/routes";
import { svgToPng } from "@/lib/svg-export";
import { encodeShareState } from "@/lib/utils/share/hash";
import { parseSchema, toMermaidEr } from "@/lib/utils/sql/er";

const EXAMPLE = `CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(32) NOT NULL UNIQUE,
  price NUMERIC(10, 2) NOT NULL
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  placed_at TIMESTAMP
);

CREATE TABLE order_items (
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  PRIMARY KEY (order_id, product_id),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);`;

export default function SqlEr() {
  const t = useTranslations("tools.sql-er");
  const tc = useTranslations("common");
  const locale = useAppLocale();
  const [sql, setSql] = useToolInput("sql-er", "");
  const [view, setView] = useState<"diagram" | "code">("diagram");
  const debounced = useDebounced(sql, 300);

  const schema = useMemo(() => parseSchema(debounced), [debounced]);
  const mermaidCode = useMemo(() => (schema.tables.length ? toMermaidEr(schema) : ""), [schema]);
  const { svg, error } = useMermaid(mermaidCode);
  const mermaidHref = `${toolPath("mermaid", locale)}#${encodeShareState({ code: mermaidCode })}`;

  return (
    <ToolShell
      toolId="sql-er"
      inputLabel="schema.sql"
      outputLabel={t("diagram")}
      defaultInputSize={38}
      onExample={() => setSql(EXAMPLE)}
      onClear={() => setSql("")}
      copyText={mermaidCode}
      toolbar={
        <Segmented
          label={t("view")}
          value={view}
          onChange={setView}
          options={[
            { value: "diagram", label: t("diagram") },
            { value: "code", label: "Mermaid" },
          ]}
        />
      }
      inputActions={<FileOpenButton accept=".sql,text/plain" onText={setSql} />}
      outputActions={
        mermaidCode && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={!svg}
              onClick={() => downloadBlob(new Blob([svg], { type: "image/svg+xml" }), "schema.svg")}
            >
              <Download />
              SVG
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={!svg}
              onClick={async () => downloadBlob(await svgToPng(svg), "schema.png")}
            >
              <ImageDown />
              PNG
            </Button>
            {/* Full navigation: the Mermaid editor reads the diagram from the #. */}
            <a href={mermaidHref} className={buttonVariants({ variant: "ghost", size: "xs" })}>
              <ExternalLink />
              {t("openMermaid")}
            </a>
          </>
        )
      }
      input={
        <FileDrop onText={setSql}>
          <CodeEditor value={sql} onChange={setSql} language="sql" ariaLabel="SQL" placeholder={t("placeholder")} />
        </FileDrop>
      }
      output={
        !debounced.trim() ? (
          <p className="p-4 text-sm text-muted-foreground">{tc("emptyHint")}</p>
        ) : schema.tables.length === 0 ? (
          <p role="alert" className="flex items-center gap-2 p-4 text-sm text-destructive">
            <CircleAlert className="size-4" aria-hidden />
            {t("noTables")}
          </p>
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <p
              role="status"
              className="shrink-0 border-b px-3 py-1.5 text-xs text-muted-foreground"
              data-testid="er-summary"
            >
              {t("summary", { tables: schema.tables.length, relations: schema.relations.length })}
            </p>
            {error && (
              <p className="shrink-0 border-b bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
                {error}
              </p>
            )}
            {view === "code" ? (
              <div className="min-h-0 flex-1" data-testid="converter-output">
                <CodeEditor value={mermaidCode} readOnly ariaLabel="Mermaid" reportStatus={false} />
              </div>
            ) : (
              <div
                className="min-h-0 flex-1 overflow-auto p-4 [&_svg]:h-auto [&_svg]:max-w-none"
                data-testid="er-diagram"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            )}
          </div>
        )
      }
    />
  );
}
