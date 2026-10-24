"use client";

import { useMemo, useRef, useState } from "react";
import { CircleCheck, CircleX, FileUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { CodeEditor } from "@/components/shared/code-editor";
import { CopyButton } from "@/components/shared/copy-button";
import { ToolShell } from "@/components/shared/tool-shell";
import { Segmented } from "@/components/shared/toolbar-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppLocale } from "@/hooks/use-app-locale";
import { useDebounced } from "@/hooks/use-debounced";
import { useSettled } from "@/hooks/use-settled";
import { useToolInput } from "@/hooks/use-tool-input";
import { findMatch, hashAll, sriFromDigest } from "@/lib/utils/crypto/hash";
import { formatBytes } from "@/lib/utils/format/bytes";

const EXAMPLE = "The quick brown fox jumps over the lazy dog";

export default function HashTool() {
  const t = useTranslations("tools.hash");
  const tc = useTranslations("common");
  const locale = useAppLocale();
  const [text, setText] = useToolInput("hash", "");
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [encoding, setEncoding] = useState<"hex" | "base64">("hex");
  const [expected, setExpected] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const debounced = useDebounced(text, 150);

  const pending = useMemo(
    () => (file ? hashAll(file.bytes) : debounced ? hashAll(debounced) : null),
    [file, debounced],
  );
  const { value: digests } = useSettled(pending);
  const match = digests && expected.trim() ? findMatch(digests, expected) : null;

  return (
    <ToolShell
      toolId="hash"
      inputLabel={file ? file.name : t("input")}
      outputLabel={t("hashes")}
      onExample={() => {
        setFile(null);
        setText(EXAMPLE);
      }}
      onClear={() => {
        setFile(null);
        setText("");
        setExpected("");
      }}
      copyText={digests?.find((d) => d.algorithm === "SHA-256")?.[encoding] ?? ""}
      toolbar={
        <Segmented
          label={t("encoding")}
          value={encoding}
          onChange={setEncoding}
          options={[
            { value: "hex", label: "Hex" },
            { value: "base64", label: "Base64" },
          ]}
        />
      }
      inputActions={
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInput.current?.click()}
            aria-label={t("hashFile")}
          >
            <FileUp />
            <span className="hidden lg:inline">{t("hashFile")}</span>
          </Button>
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            tabIndex={-1}
            aria-hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setFile({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
              e.target.value = "";
            }}
          />
        </>
      }
      input={
        <div className="flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1">
            {file ? (
              <div className="space-y-3 p-4 text-sm">
                <p className="font-mono">
                  {file.name} · {formatBytes(file.bytes.length, locale)}
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => setFile(null)}>
                  {tc("clear")}
                </Button>
              </div>
            ) : (
              <CodeEditor
                value={text}
                onChange={setText}
                lineWrapping
                ariaLabel={t("input")}
                placeholder={t("placeholder")}
              />
            )}
          </div>
          <div className="shrink-0 space-y-1.5 border-t bg-surface-1 p-3">
            <Label htmlFor="hash-expected" className="text-xs">
              {t("expected")}
            </Label>
            <Input
              id="hash-expected"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              placeholder="sha256 / sha384-… / md5"
              className="h-8 font-mono text-xs"
              spellCheck={false}
            />
          </div>
        </div>
      }
      output={
        !digests ? (
          <p className="p-4 text-sm text-muted-foreground">{tc("emptyHint")}</p>
        ) : (
          <div>
            {expected.trim() && (
              <p
                role="status"
                className={`flex items-center gap-2 border-b px-3 py-2 text-sm ${match ? "text-success" : "text-destructive"}`}
              >
                {match ? <CircleCheck className="size-4" aria-hidden /> : <CircleX className="size-4" aria-hidden />}
                {match ? t("matches", { algorithm: match }) : t("noMatch")}
              </p>
            )}
            <ul aria-label={t("hashes")}>
              {digests.map((d) => {
                const sri = sriFromDigest(d);
                return (
                  <li key={d.algorithm} className="space-y-1 border-b px-3 py-2.5 last:border-b-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-mono text-xs font-semibold text-accent-text">{d.algorithm}</h3>
                      <CopyButton text={d[encoding]} size="icon-sm" />
                    </div>
                    <p data-testid={`digest-${d.algorithm}`} className="font-mono text-[13px] break-all">
                      {d[encoding]}
                    </p>
                    {sri && encoding === "base64" && (
                      <p className="font-mono text-xs break-all text-muted-foreground">SRI: {sri}</p>
                    )}
                    {(d.algorithm === "MD5" || d.algorithm === "SHA-1") && (
                      <p className="text-xs text-warning">{t("weak")}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )
      }
    />
  );
}
