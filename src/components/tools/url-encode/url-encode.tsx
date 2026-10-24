"use client";

import { useMemo, useState } from "react";
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { CodeEditor } from "@/components/shared/code-editor";
import { CopyButton } from "@/components/shared/copy-button";
import { ToolShell } from "@/components/shared/tool-shell";
import { Segmented, ToolbarSwitch } from "@/components/shared/toolbar-controls";
import { useDebounced } from "@/hooks/use-debounced";
import { useToolInput } from "@/hooks/use-tool-input";
import { urlDecode, urlEncodeAll, type UrlEncodings } from "@/lib/utils/encoding/url-encode";

type Mode = "encode" | "decode";

const EXAMPLE = "https://example.com/búsqueda?q=café con leche & tostadas&page=2#sección";

export default function UrlEncode() {
  const t = useTranslations("tools.url-encode");
  const tc = useTranslations("common");
  const [input, setInput] = useToolInput("url-encode", "");
  const [mode, setMode] = useState<Mode>("encode");
  const [plus, setPlus] = useState(false);
  const debounced = useDebounced(input, 150);

  const encoded = useMemo(() => (mode === "encode" && debounced ? urlEncodeAll(debounced) : null), [mode, debounced]);
  const decoded = useMemo(
    () => (mode === "decode" && debounced ? urlDecode(debounced, plus) : null),
    [mode, debounced, plus],
  );
  const main = encoded ? encoded.component : decoded?.ok ? decoded.output : "";

  const variants: { key: keyof UrlEncodings; fn: string }[] = [
    { key: "component", fn: "encodeURIComponent" },
    { key: "uri", fn: "encodeURI" },
    { key: "form", fn: "x-www-form-urlencoded" },
  ];

  return (
    <ToolShell
      toolId="url-encode"
      inputLabel={mode === "encode" ? t("text") : t("encoded")}
      outputLabel={mode === "encode" ? t("encoded") : t("text")}
      onExample={() => {
        setMode("encode");
        setInput(EXAMPLE);
      }}
      onClear={() => setInput("")}
      onSwap={() => {
        if (main) setInput(main);
        setMode((m) => (m === "encode" ? "decode" : "encode"));
      }}
      copyText={main}
      toolbar={
        <>
          <Segmented
            label={t("mode")}
            value={mode}
            onChange={setMode}
            options={[
              { value: "encode", label: t("encode") },
              { value: "decode", label: t("decode") },
            ]}
          />
          {mode === "decode" && <ToolbarSwitch label={t("plusAsSpace")} checked={plus} onChange={setPlus} />}
        </>
      }
      input={
        <CodeEditor
          value={input}
          onChange={setInput}
          lineWrapping
          ariaLabel={mode === "encode" ? t("text") : t("encoded")}
          placeholder={mode === "encode" ? t("placeholderEncode") : t("placeholderDecode")}
        />
      }
      output={
        encoded ? (
          <ul className="divide-y" aria-label={t("encoded")}>
            {variants.map(({ key, fn }) => (
              <li key={key} className="space-y-1.5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-mono text-xs text-accent-text">{fn}</h3>
                  <CopyButton text={encoded[key]} size="icon-sm" />
                </div>
                <p className="text-xs text-muted-foreground">{t(`hint.${key}`)}</p>
                <p data-testid={`encoded-${key}`} className="rounded bg-editor p-2 font-mono text-[13px] break-all">
                  {encoded[key]}
                </p>
              </li>
            ))}
          </ul>
        ) : decoded && !decoded.ok ? (
          <p role="alert" className="flex items-center gap-2 p-4 text-sm text-destructive">
            <CircleAlert className="size-4" aria-hidden />
            {decoded.column !== undefined && (
              <span className="font-mono text-xs text-muted-foreground">
                {tc("position", { line: 1, column: decoded.column })}
              </span>
            )}
            {decoded.error}
          </p>
        ) : decoded?.ok ? (
          <div className="h-full" data-testid="converter-output">
            <CodeEditor value={decoded.output} readOnly lineWrapping ariaLabel={t("text")} reportStatus={false} />
          </div>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">{tc("emptyHint")}</p>
        )
      }
    />
  );
}
