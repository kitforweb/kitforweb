"use client";

import { useId, useMemo, useState } from "react";
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { CodeEditor } from "@/components/shared/code-editor";
import { CopyButton } from "@/components/shared/copy-button";
import { ToolShell } from "@/components/shared/tool-shell";
import { Segmented } from "@/components/shared/toolbar-controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebounced } from "@/hooks/use-debounced";
import { useToolInput } from "@/hooks/use-tool-input";
import {
  bytesToText,
  formatInteger,
  parseInteger,
  textToBytes,
  type ByteFormat,
  type Radix,
} from "@/lib/utils/encoding/radix";

type Mode = "number" | "text";
type Direction = "toBytes" | "toText";

const BASES: { radix: Radix; label: string; prefix: string }[] = [
  { radix: 10, label: "DEC", prefix: "" },
  { radix: 16, label: "HEX", prefix: "0x" },
  { radix: 2, label: "BIN", prefix: "0b" },
  { radix: 8, label: "OCT", prefix: "0o" },
];

function BaseField({
  radix,
  label,
  prefix,
  value,
  onChange,
}: {
  radix: Radix;
  label: string;
  prefix: string;
  value: string;
  onChange: (radix: Radix, text: string) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="font-mono text-xs text-accent-text">
          {label} <span className="text-muted-foreground">({radix})</span>
        </Label>
        <CopyButton text={prefix + value} size="icon-sm" />
      </div>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(radix, e.target.value)}
        className="font-mono"
        spellCheck={false}
        autoComplete="off"
      />
    </div>
  );
}

export default function NumberBase() {
  const t = useTranslations("tools.number-base");
  const tc = useTranslations("common");
  const [mode, setMode] = useState<Mode>("number");
  const [source, setSource] = useState<{ radix: Radix; text: string }>({ radix: 10, text: "" });
  const [text, setText] = useToolInput("number-base", "");
  const [direction, setDirection] = useState<Direction>("toBytes");
  const [format, setFormat] = useState<ByteFormat>("hex");
  const debounced = useDebounced(text, 150);

  const parsed = useMemo(() => (source.text.trim() ? parseInteger(source.text, source.radix) : null), [source]);
  const display = (radix: Radix) =>
    radix === source.radix ? source.text : parsed?.ok ? formatInteger(parsed.value, radix) : "";
  const onField = (radix: Radix, value: string) => {
    // A pasted literal with prefix (0xFF) goes to the base it names.
    const auto = parseInteger(value, "auto");
    setSource(
      auto.ok && /^-?0[xbo]/i.test(value.trim())
        ? { radix: auto.radix, text: value.trim().replace(/^(-?)0[xbo]/i, "$1") }
        : { radix, text: value },
    );
  };

  const bytes = useMemo(() => {
    if (mode !== "text" || !debounced) return null;
    return direction === "toBytes"
      ? { ok: true as const, text: textToBytes(debounced, format) }
      : bytesToText(debounced, format);
  }, [mode, debounced, direction, format]);

  const bits = parsed?.ok ? (parsed.value < BigInt(0) ? -parsed.value : parsed.value).toString(2).length : 0;

  return (
    <ToolShell
      toolId="number-base"
      inputLabel={mode === "number" ? t("number") : direction === "toBytes" ? t("text") : t("bytes")}
      outputLabel={mode === "number" ? t("bases") : direction === "toBytes" ? t("bytes") : t("text")}
      defaultInputSize={mode === "number" ? 55 : 50}
      onExample={() => {
        if (mode === "number") setSource({ radix: 16, text: "C0FFEE" });
        else {
          setDirection("toBytes");
          setText("Hola 👋");
        }
      }}
      onClear={() => (mode === "number" ? setSource({ radix: 10, text: "" }) : setText(""))}
      onSwap={
        mode === "text"
          ? () => {
              if (bytes?.ok) setText(bytes.text);
              setDirection((d) => (d === "toBytes" ? "toText" : "toBytes"));
            }
          : undefined
      }
      copyText={mode === "number" ? display(16) : bytes?.ok ? bytes.text : ""}
      toolbar={
        <>
          <Segmented
            label={t("mode")}
            value={mode}
            onChange={setMode}
            options={[
              { value: "number", label: t("numbers") },
              { value: "text", label: t("textBytes") },
            ]}
          />
          {mode === "text" && (
            <Segmented
              label={t("format")}
              value={format}
              onChange={setFormat}
              options={[
                { value: "hex", label: "HEX" },
                { value: "binary", label: "BIN" },
                { value: "decimal", label: "DEC" },
              ]}
            />
          )}
        </>
      }
      input={
        mode === "number" ? (
          <form className="grid gap-4 p-4" onSubmit={(e) => e.preventDefault()}>
            {BASES.map((b) => (
              <BaseField key={b.radix} {...b} value={display(b.radix)} onChange={onField} />
            ))}
          </form>
        ) : (
          <CodeEditor
            value={text}
            onChange={setText}
            lineWrapping
            ariaLabel={direction === "toBytes" ? t("text") : t("bytes")}
            placeholder={direction === "toBytes" ? t("placeholderText") : "48 6f 6c 61"}
          />
        )
      }
      output={
        mode === "number" ? (
          !parsed ? (
            <p className="p-4 text-sm text-muted-foreground">{tc("emptyHint")}</p>
          ) : !parsed.ok ? (
            <p role="alert" className="flex items-center gap-2 p-4 text-sm text-destructive">
              <CircleAlert className="size-4" aria-hidden />
              {t("invalidDigits", { base: source.radix })}
            </p>
          ) : (
            <dl
              className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-4 font-mono text-[13px]"
              data-testid="number-summary"
            >
              <dt className="text-muted-foreground">DEC</dt>
              <dd className="break-all">{formatInteger(parsed.value, 10)}</dd>
              <dt className="text-muted-foreground">HEX</dt>
              <dd className="break-all">0x{formatInteger(parsed.value, 16, true)}</dd>
              <dt className="text-muted-foreground">BIN</dt>
              <dd className="break-all">{formatInteger(parsed.value, 2, true)}</dd>
              <dt className="text-muted-foreground">{t("bits")}</dt>
              <dd>{bits}</dd>
            </dl>
          )
        ) : !bytes ? (
          <p className="p-4 text-sm text-muted-foreground">{tc("emptyHint")}</p>
        ) : !bytes.ok ? (
          <p role="alert" className="flex items-center gap-2 p-4 text-sm text-destructive">
            <CircleAlert className="size-4" aria-hidden />
            {t(`errors.${bytes.error}`)}
          </p>
        ) : (
          <div className="h-full" data-testid="converter-output">
            <CodeEditor value={bytes.text} readOnly lineWrapping ariaLabel={t("bytes")} reportStatus={false} />
          </div>
        )
      }
    />
  );
}
