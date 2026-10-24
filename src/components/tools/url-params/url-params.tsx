"use client";

import { useMemo, useState } from "react";
import { CircleAlert, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { CodeEditor } from "@/components/shared/code-editor";
import { CopyButton } from "@/components/shared/copy-button";
import { ToolShell } from "@/components/shared/tool-shell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDebounced } from "@/hooks/use-debounced";
import { useToolInput } from "@/hooks/use-tool-input";
import { buildUrl, parseUrl, type ParsedUrl, type UrlParam } from "@/lib/utils/encoding/url-params";
import { matchesQuery } from "@/lib/utils/search/match";

const EXAMPLE =
  "https://shop.example.com/search?q=caf%C3%A9+con+leche&tag=coffee&tag=organic&filter=%7B%22price%22%3A%7B%22max%22%3A20%7D%7D&utm_source=newsletter&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback%3Fstate%3Dxyz%26lang%3Des#access_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MiJ9.c2lnbmF0dXJl&expires_in=3600";

type Edits = Record<string, string>;

function ParamTable({
  params,
  section,
  edits,
  onEdit,
  query,
}: {
  params: UrlParam[];
  section: string;
  edits?: Edits;
  onEdit?: (id: string, value: string) => void;
  query: string;
}) {
  const t = useTranslations("tools.url-params");
  const rows = params
    .map((p, i) => ({ p, id: `${section}:${i}` }))
    .filter(({ p }) => matchesQuery(query, [p.key, p.value]));
  if (rows.length === 0) return <p className="px-3 py-2 text-xs text-muted-foreground">{t("none")}</p>;
  return (
    <table className="w-full text-[13px]">
      <thead className="text-left text-xs text-muted-foreground">
        <tr>
          <th className="w-1/3 px-3 py-1.5 font-medium">{t("key")}</th>
          <th className="px-3 py-1.5 font-medium">{t("value")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ p, id }) => (
          <tr key={id} className="border-t align-top">
            <td className="px-3 py-2 font-mono break-all text-[var(--syntax-key)]">
              {p.key}
              {p.occurrence > 0 && <span className="ms-1 text-xs text-muted-foreground">#{p.occurrence + 1}</span>}
            </td>
            <td className="space-y-1.5 px-3 py-2">
              <div className="flex items-center gap-2">
                {onEdit ? (
                  <Input
                    value={edits?.[id] ?? p.value}
                    onChange={(e) => onEdit(id, e.target.value)}
                    aria-label={t("valueOf", { key: p.key })}
                    className="h-7 font-mono text-xs"
                    spellCheck={false}
                  />
                ) : (
                  <span className="font-mono break-all">{p.value}</span>
                )}
                {p.kind && (
                  <Badge variant="outline" className="shrink-0 uppercase">
                    {p.kind}
                  </Badge>
                )}
                <CopyButton text={edits?.[id] ?? p.value} size="icon-sm" />
              </div>
              {p.preview && (
                <pre className="max-h-40 overflow-auto rounded bg-editor p-2 font-mono text-xs whitespace-pre-wrap">
                  {p.preview}
                </pre>
              )}
              {p.nested && (
                <details className="rounded border">
                  <summary className="cursor-pointer px-2 py-1 font-mono text-xs text-muted-foreground">
                    {p.nested.host}
                    {p.nested.pathname}
                  </summary>
                  <ParamTable params={p.nested.params} section={`${id}>`} query="" />
                </details>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function UrlParams() {
  const t = useTranslations("tools.url-params");
  const tc = useTranslations("common");
  const [input, setInput] = useToolInput("url-params", "");
  const [query, setQuery] = useState("");
  const [edits, setEdits] = useState<{ source: string; values: Edits }>({ source: "", values: {} });
  const debounced = useDebounced(input, 200);
  const parsed = useMemo(() => (debounced.trim() ? parseUrl(debounced) : null), [debounced]);
  const url: ParsedUrl | null = parsed && "url" in parsed ? parsed.url : null;
  // Edits belong to the URL they were made on.
  const values = useMemo<Edits>(() => (edits.source === debounced ? edits.values : {}), [edits, debounced]);

  const rebuilt = useMemo(() => {
    if (!url || Object.keys(values).length === 0) return "";
    const apply = (list: UrlParam[], section: string) =>
      list.map((p, i) => ({ key: p.key, value: values[`${section}:${i}`] ?? p.value }));
    return buildUrl(url.href, apply(url.params, "q"), apply(url.hashParams, "h"));
  }, [url, values]);

  const onEdit = (id: string, value: string) => setEdits({ source: debounced, values: { ...values, [id]: value } });

  return (
    <ToolShell
      toolId="url-params"
      inputLabel="URL"
      outputLabel={t("parameters")}
      defaultInputSize={35}
      onExample={() => setInput(EXAMPLE)}
      onClear={() => setInput("")}
      copyText={rebuilt || url?.href || ""}
      input={
        <CodeEditor value={input} onChange={setInput} lineWrapping ariaLabel="URL" placeholder={t("placeholder")} />
      }
      output={
        !parsed ? (
          <p className="p-4 text-sm text-muted-foreground">{tc("emptyHint")}</p>
        ) : !url ? (
          <p role="alert" className="flex items-center gap-2 p-4 text-sm text-destructive">
            <CircleAlert className="size-4" aria-hidden />
            {t("invalid")}
          </p>
        ) : (
          <div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-b px-3 py-2 font-mono text-xs">
              <dt className="text-muted-foreground">{t("protocol")}</dt>
              <dd>{url.protocol}</dd>
              <dt className="text-muted-foreground">{t("host")}</dt>
              <dd className="break-all">{url.host}</dd>
              <dt className="text-muted-foreground">{t("path")}</dt>
              <dd className="break-all">{url.pathname}</dd>
              {url.hash && (
                <>
                  <dt className="text-muted-foreground">#</dt>
                  <dd className="break-all">{url.hash}</dd>
                </>
              )}
            </dl>
            <div className="relative border-b p-2">
              <Search
                className="pointer-events-none absolute inset-y-0 start-4 my-auto size-3.5 text-muted-foreground"
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
            <section aria-label={t("query")}>
              <h3 className="bg-surface-1 px-3 py-1 text-xs font-semibold text-muted-foreground">
                {t("query")} ({url.params.length})
              </h3>
              <ParamTable params={url.params} section="q" edits={values} onEdit={onEdit} query={query} />
            </section>
            {url.hashParams.length > 0 && (
              <section aria-label={t("fragment")}>
                <h3 className="bg-surface-1 px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {t("fragment")} ({url.hashParams.length})
                </h3>
                <ParamTable params={url.hashParams} section="h" edits={values} onEdit={onEdit} query={query} />
              </section>
            )}
            {rebuilt && (
              <section className="space-y-1 border-t p-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-muted-foreground">{t("rebuilt")}</h3>
                  <CopyButton text={rebuilt} size="icon-sm" />
                </div>
                <p data-testid="rebuilt-url" className="font-mono text-xs break-all">
                  {rebuilt}
                </p>
              </section>
            )}
          </div>
        )
      }
    />
  );
}
