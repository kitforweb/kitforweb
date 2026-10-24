"use client";

import { useMemo, useState } from "react";
import { CircleAlert, CircleCheck, Search, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { CodeEditor } from "@/components/shared/code-editor";
import { FileDrop, FileOpenButton } from "@/components/shared/file-drop";
import { ToolShell } from "@/components/shared/tool-shell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDebounced } from "@/hooks/use-debounced";
import { useToolInput } from "@/hooks/use-tool-input";
import { parseOpenApi, type ApiOperation, type HttpMethod } from "@/lib/utils/api/openapi";
import { matchesQuery } from "@/lib/utils/search/match";
import { cn } from "cn";

const EXAMPLE = `openapi: 3.0.3
info:
  title: Bookstore API
  version: 1.4.0
  description: Manage books and orders.
servers:
  - url: https://api.bookstore.example/v1
tags:
  - name: books
    description: The catalogue
  - name: orders
paths:
  /books:
    get:
      tags: [books]
      summary: List books
      operationId: listBooks
      parameters:
        - name: q
          in: query
          description: Full-text search
          schema: { type: string }
        - name: limit
          in: query
          schema: { type: integer, default: 20 }
      responses:
        "200":
          description: A page of books
          content:
            application/json:
              schema:
                type: array
                items: { $ref: "#/components/schemas/Book" }
  /books/{bookId}:
    get:
      tags: [books]
      summary: Get a book
      operationId: getBook
      parameters:
        - name: bookId
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        "200":
          description: The book
          content:
            application/json:
              schema: { $ref: "#/components/schemas/Book" }
        "404":
          description: Not found
  /orders:
    post:
      tags: [orders]
      summary: Place an order
      operationId: createOrder
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [bookId, quantity]
              properties:
                bookId: { type: string, format: uuid }
                quantity: { type: integer, minimum: 1 }
      responses:
        "201":
          description: Order created
components:
  schemas:
    Book:
      type: object
      properties:
        id: { type: string, format: uuid }
        title: { type: string }
        price: { type: number }
`;

const METHOD_STYLE: Record<HttpMethod, string> = {
  get: "bg-success/15 text-success",
  post: "bg-primary/15 text-accent-text",
  put: "bg-warning/15 text-warning",
  patch: "bg-warning/15 text-warning",
  delete: "bg-destructive/15 text-destructive",
  head: "bg-muted text-muted-foreground",
  options: "bg-muted text-muted-foreground",
  trace: "bg-muted text-muted-foreground",
};

function Schema({ value }: { value: unknown }) {
  if (value === undefined) return null;
  return (
    <pre className="max-h-64 overflow-auto rounded-md bg-editor p-2 font-mono text-[11px] leading-5">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function Operation({ op }: { op: ApiOperation }) {
  const t = useTranslations("tools.openapi-viewer");
  return (
    <details className="group rounded-md border" data-testid="api-operation">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 marker:hidden">
        <span
          className={cn(
            "w-16 shrink-0 rounded px-1.5 py-0.5 text-center font-mono text-[11px] font-bold uppercase",
            METHOD_STYLE[op.method],
          )}
        >
          {op.method}
        </span>
        <code className={cn("font-mono text-[13px] break-all", op.deprecated && "line-through opacity-60")}>
          {op.path}
        </code>
        <span className="ms-auto truncate text-xs text-muted-foreground">{op.summary}</span>
      </summary>
      <div className="space-y-3 border-t px-3 py-3 text-sm">
        {op.description && <p className="text-muted-foreground">{op.description}</p>}
        {op.operationId && <p className="font-mono text-xs text-muted-foreground">operationId: {op.operationId}</p>}
        {op.parameters.length > 0 && (
          <section>
            <h4 className="mb-1 text-xs font-semibold text-muted-foreground">{t("parameters")}</h4>
            <table className="w-full text-xs">
              <tbody>
                {op.parameters.map((p) => (
                  <tr key={`${p.in}:${p.name}`} className="border-t align-top">
                    <td className="py-1 pe-2 font-mono">
                      {p.name}
                      {p.required && <span className="text-destructive">*</span>}
                    </td>
                    <td className="py-1 pe-2 text-muted-foreground">{p.in}</td>
                    <td className="py-1 pe-2 font-mono text-accent-text">{p.type}</td>
                    <td className="py-1 text-muted-foreground">{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        {op.requestBody && (
          <section>
            <h4 className="mb-1 text-xs font-semibold text-muted-foreground">
              {t("requestBody")} {op.requestBody.required && <span className="text-destructive">*</span>}{" "}
              <span className="font-mono font-normal">{op.requestBody.contentTypes.join(", ")}</span>
            </h4>
            <Schema value={op.requestBody.schema} />
          </section>
        )}
        <section>
          <h4 className="mb-1 text-xs font-semibold text-muted-foreground">{t("responses")}</h4>
          <ul className="space-y-1.5">
            {op.responses.map((r) => (
              <li key={r.status}>
                <span className="font-mono text-xs font-semibold">{r.status}</span>{" "}
                <span className="text-xs text-muted-foreground">{r.description}</span>
                <Schema value={r.schema} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </details>
  );
}

export default function OpenApiViewer() {
  const t = useTranslations("tools.openapi-viewer");
  const tc = useTranslations("common");
  const [text, setText] = useToolInput("openapi-viewer", "");
  const [query, setQuery] = useState("");
  const debounced = useDebounced(text, 300);
  const result = useMemo(() => (debounced.trim() ? parseOpenApi(debounced) : null), [debounced]);
  const doc = result?.ok ? result.doc : null;

  const groups = useMemo(() => {
    if (!doc) return [];
    const ops = doc.operations.filter((o) =>
      matchesQuery(query, [o.method, o.path, o.summary ?? "", o.operationId ?? "", ...o.tags]),
    );
    const names = [
      ...new Set([...doc.tags.map((x) => x.name), ...ops.flatMap((o) => (o.tags.length ? o.tags : [t("untagged")]))]),
    ];
    return names
      .map((name) => ({
        name,
        description: doc.tags.find((x) => x.name === name)?.description,
        ops: ops.filter((o) => (o.tags.length ? o.tags.includes(name) : name === t("untagged"))),
      }))
      .filter((g) => g.ops.length > 0);
  }, [doc, query, t]);

  return (
    <ToolShell
      toolId="openapi-viewer"
      inputLabel="openapi.yaml"
      outputLabel={t("docs")}
      defaultInputSize={38}
      onExample={() => setText(EXAMPLE)}
      onClear={() => setText("")}
      copyText={doc ? doc.operations.map((o) => `${o.method.toUpperCase()} ${o.path}`).join("\n") : ""}
      inputActions={<FileOpenButton accept=".yaml,.yml,.json" onText={setText} />}
      input={
        <FileDrop onText={setText}>
          <CodeEditor
            value={text}
            onChange={setText}
            language="yaml"
            ariaLabel="OpenAPI"
            placeholder={t("placeholder")}
          />
        </FileDrop>
      }
      output={
        !result ? (
          <p className="p-4 text-sm text-muted-foreground">{tc("emptyHint")}</p>
        ) : !result.ok ? (
          <p role="alert" className="flex items-start gap-2 p-4 text-sm text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {result.line !== undefined && (
              <span className="font-mono text-xs text-muted-foreground">
                {tc("position", { line: result.line, column: result.column ?? 1 })}
              </span>
            )}
            {result.error}
          </p>
        ) : (
          <div className="space-y-4 p-4">
            <header className="space-y-1">
              <h3 className="text-xl font-semibold" data-testid="api-title">
                {doc!.title} <Badge variant="outline">{doc!.apiVersion}</Badge>{" "}
                <Badge variant="secondary">
                  {doc!.version === "openapi-3" ? `OpenAPI ${doc!.specVersion}` : "Swagger 2.0"}
                </Badge>
              </h3>
              {doc!.description && <p className="text-sm text-muted-foreground">{doc!.description}</p>}
              {doc!.servers.map((s) => (
                <p key={s} className="font-mono text-xs text-accent-text">
                  {s}
                </p>
              ))}
            </header>
            <section aria-label={t("issues")} data-testid="api-issues">
              {doc!.issues.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-success">
                  <CircleCheck className="size-4" aria-hidden />
                  {t("valid")}
                </p>
              ) : (
                <ul className="space-y-1">
                  {doc!.issues.map((i, n) => (
                    <li
                      key={n}
                      className={cn(
                        "flex items-start gap-2 text-xs",
                        i.severity === "error" ? "text-destructive" : "text-warning",
                      )}
                    >
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      <span>
                        <span className="font-mono">{i.path}</span> — {i.message}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <div className="relative">
              <Search
                className="pointer-events-none absolute inset-y-0 start-2 my-auto size-3.5 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("search")}
                aria-label={t("search")}
                className="h-8 ps-7 text-xs"
              />
            </div>
            {groups.map((g) => (
              <section key={g.name} className="space-y-2">
                <h3 className="font-heading text-sm font-semibold">
                  {g.name} <span className="font-normal text-muted-foreground">{g.description}</span>
                </h3>
                {g.ops.map((op) => (
                  <Operation key={`${op.method} ${op.path}`} op={op} />
                ))}
              </section>
            ))}
            {doc!.schemas.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("schemas")}: <span className="font-mono">{doc!.schemas.join(", ")}</span>
              </p>
            )}
          </div>
        )
      }
    />
  );
}
