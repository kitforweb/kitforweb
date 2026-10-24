"use client";

import { useMemo, useRef, useState } from "react";
import { CircleAlert, Download, FileUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { CodeEditor } from "@/components/shared/code-editor";
import { ToolShell } from "@/components/shared/tool-shell";
import { Segmented, ToolbarSwitch } from "@/components/shared/toolbar-controls";
import { Button } from "@/components/ui/button";
import { useAppLocale } from "@/hooks/use-app-locale";
import { useDebounced } from "@/hooks/use-debounced";
import { useToolInput } from "@/hooks/use-tool-input";
import { downloadBlob } from "@/lib/download";
import { bytesToBase64, decodeBase64, encodeBase64 } from "@/lib/utils/encoding/base64";
import { formatBytes } from "@/lib/utils/format/bytes";

type Mode = "encode" | "decode";

interface LoadedFile {
  name: string;
  type: string;
  bytes: Uint8Array;
}

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "application/zip": "zip",
  "application/gzip": "gz",
};

export default function Base64Tool() {
  const t = useTranslations("tools.base64");
  const tc = useTranslations("common");
  const locale = useAppLocale();
  const [input, setInput] = useToolInput("base64", "");
  const [mode, setMode] = useState<Mode>("encode");
  const [urlSafe, setUrlSafe] = useState(false);
  const [dataUrl, setDataUrl] = useState(false);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const debounced = useDebounced(input, 150);

  const encoded = useMemo(() => {
    if (mode !== "encode") return "";
    if (file) {
      const b64 = bytesToBase64(file.bytes, urlSafe && !dataUrl);
      return dataUrl ? `data:${file.type || "application/octet-stream"};base64,${b64}` : b64;
    }
    if (!debounced) return "";
    const b64 = encodeBase64(debounced, urlSafe && !dataUrl);
    return dataUrl ? `data:text/plain;charset=utf-8;base64,${b64}` : b64;
  }, [mode, file, debounced, urlSafe, dataUrl]);

  const decoded = useMemo(
    () => (mode === "decode" && debounced.trim() ? decodeBase64(debounced) : null),
    [mode, debounced],
  );
  const decodedImage = useMemo(() => {
    if (!decoded?.ok || !decoded.mime?.startsWith("image/")) return null;
    return `data:${decoded.mime};base64,${bytesToBase64(decoded.bytes)}`;
  }, [decoded]);
  const previewImage = file?.type.startsWith("image/") ? `data:${file.type};base64,${bytesToBase64(file.bytes)}` : null;

  const output = mode === "encode" ? encoded : decoded?.ok && decoded.text !== null ? decoded.text : "";

  const loadFile = async (f: File) => {
    setFile({ name: f.name, type: f.type, bytes: new Uint8Array(await f.arrayBuffer()) });
    setMode("encode");
  };

  return (
    <ToolShell
      toolId="base64"
      inputLabel={mode === "encode" ? t("plain") : "Base64"}
      outputLabel={mode === "encode" ? "Base64" : t("plain")}
      onExample={() => {
        setFile(null);
        setMode("encode");
        setInput("Hola, kitforweb 👋");
      }}
      onClear={() => {
        setFile(null);
        setInput("");
      }}
      onSwap={() => {
        if (output && !file) setInput(output);
        setFile(null);
        setMode((m) => (m === "encode" ? "decode" : "encode"));
      }}
      copyText={output}
      toolbar={
        <>
          <Segmented
            label={t("mode")}
            value={mode}
            onChange={(m) => {
              setMode(m);
              if (m === "decode") setFile(null);
            }}
            options={[
              { value: "encode", label: t("encode") },
              { value: "decode", label: t("decode") },
            ]}
          />
          {mode === "encode" && (
            <>
              <ToolbarSwitch label="Base64URL" checked={urlSafe} onChange={setUrlSafe} />
              <ToolbarSwitch label="Data URL" checked={dataUrl} onChange={setDataUrl} />
            </>
          )}
        </>
      }
      inputActions={
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInput.current?.click()}
            aria-label={t("encodeFile")}
          >
            <FileUp />
            <span className="hidden lg:inline">{t("encodeFile")}</span>
          </Button>
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void loadFile(f);
              e.target.value = "";
            }}
          />
        </>
      }
      input={
        file ? (
          <div className="space-y-3 p-4 text-sm">
            <p className="font-mono">
              {file.name} · {formatBytes(file.bytes.length, locale)}
            </p>
            {previewImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewImage}
                alt={file.name}
                className="max-h-64 max-w-full rounded border bg-[repeating-conic-gradient(#8882_0_25%,transparent_0_50%)] bg-[length:16px_16px]"
              />
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => setFile(null)}>
              {tc("clear")}
            </Button>
          </div>
        ) : (
          <CodeEditor
            value={input}
            onChange={setInput}
            lineWrapping
            ariaLabel={mode === "encode" ? t("plain") : "Base64"}
            placeholder={mode === "encode" ? t("placeholderEncode") : t("placeholderDecode")}
          />
        )
      }
      output={
        mode === "encode" ? (
          encoded ? (
            <div className="flex h-full min-h-0 flex-col">
              <p role="status" className="shrink-0 border-b px-3 py-1.5 font-mono text-xs text-muted-foreground">
                {formatBytes(encoded.length, locale)}
              </p>
              <div className="min-h-0 flex-1" data-testid="converter-output">
                <CodeEditor value={encoded} readOnly lineWrapping ariaLabel="Base64" reportStatus={false} />
              </div>
            </div>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">{tc("emptyHint")}</p>
          )
        ) : !decoded ? (
          <p className="p-4 text-sm text-muted-foreground">{tc("emptyHint")}</p>
        ) : !decoded.ok ? (
          <p role="alert" className="flex items-center gap-2 p-4 text-sm text-destructive">
            <CircleAlert className="size-4" aria-hidden />
            {t(`errors.${decoded.error}`)}
          </p>
        ) : decoded.text !== null ? (
          <div className="h-full" data-testid="converter-output">
            <CodeEditor value={decoded.text} readOnly lineWrapping ariaLabel={t("plain")} reportStatus={false} />
          </div>
        ) : (
          <div className="space-y-3 p-4 text-sm">
            <p className="font-mono text-muted-foreground">
              {decoded.mime ?? t("binary")} · {formatBytes(decoded.bytes.length, locale)}
            </p>
            {decodedImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={decodedImage} alt={t("preview")} className="max-h-72 max-w-full rounded border" />
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                downloadBlob(
                  new Blob([decoded.bytes as BlobPart], { type: decoded.mime ?? "application/octet-stream" }),
                  `decoded.${EXTENSIONS[decoded.mime ?? ""] ?? "bin"}`,
                )
              }
            >
              <Download />
              {tc("download")}
            </Button>
          </div>
        )
      }
    />
  );
}
