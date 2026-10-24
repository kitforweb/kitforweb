"use client";

import { useMemo, useState } from "react";
import { CircleAlert, KeyRound, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { CodeEditor } from "@/components/shared/code-editor";
import { CopyButton } from "@/components/shared/copy-button";
import { ToolShell } from "@/components/shared/tool-shell";
import { Segmented, ToolbarSelect } from "@/components/shared/toolbar-controls";
import { Button } from "@/components/ui/button";
import { useDebounced } from "@/hooks/use-debounced";
import { useSettled } from "@/hooks/use-settled";
import { useToolInput } from "@/hooks/use-tool-input";
import {
  generateKeyPairPem,
  jwkToPem,
  pemToJwk,
  type Curve,
  type ExportedKeyPair,
  type KeyType,
  type RsaSize,
} from "@/lib/utils/crypto/keys";

type Mode = "generate" | "convert";

const EXAMPLE_PEM = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEXKpbq1uSJZJtspeeJ4BsKgdOupHH
gJAGI+HcwV+0Cwk+SkT7NOrUAYi8TbXiIjk9MT9SZdAMLSbrC68ifKelYg==
-----END PUBLIC KEY-----`;

function KeyBlock({ title, value, testId }: { title: string; value: string; testId?: string }) {
  return (
    <section className="space-y-1.5 border-b p-3 last:border-b-0">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-xs font-semibold text-accent-text">{title}</h3>
        <CopyButton text={value} size="icon-sm" />
      </div>
      <pre data-testid={testId} className="max-h-64 overflow-auto rounded-md bg-editor p-3 font-mono text-xs">
        {value}
      </pre>
    </section>
  );
}

export default function KeyPairTool() {
  const t = useTranslations("tools.keypair");
  const tc = useTranslations("common");
  const [mode, setMode] = useState<Mode>("generate");
  const [type, setType] = useState<KeyType>("EC");
  const [rsaSize, setRsaSize] = useState<RsaSize>(2048);
  const [curve, setCurve] = useState<Curve>("P-256");
  const [generating, setGenerating] = useState(false);
  const [pair, setPair] = useState<ExportedKeyPair | null>(null);
  // Sensitive tool: useToolInput never persists it.
  const [input, setInput] = useToolInput("keypair", "");
  const debounced = useDebounced(input, 200);

  const converting = useMemo(() => {
    if (mode !== "convert" || !debounced.trim()) return null;
    return debounced.trim().startsWith("{") ? jwkToPem(debounced) : pemToJwk(debounced);
  }, [mode, debounced]);
  const { value: converted } = useSettled(converting);

  const generate = async () => {
    setGenerating(true);
    try {
      setPair(await generateKeyPairPem({ type, rsaSize, curve }));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ToolShell
      toolId="keypair"
      inputLabel={mode === "generate" ? t("options") : t("pemOrJwk")}
      outputLabel={mode === "generate" ? t("keys") : t("converted")}
      onExample={() => {
        setMode("convert");
        setInput(EXAMPLE_PEM);
      }}
      onClear={() => {
        setPair(null);
        setInput("");
      }}
      copyText={mode === "generate" ? (pair?.publicPem ?? "") : converted?.ok ? converted.output : ""}
      toolbar={
        <Segmented
          label={t("mode")}
          value={mode}
          onChange={setMode}
          options={[
            { value: "generate", label: t("generate") },
            { value: "convert", label: t("convert") },
          ]}
        />
      }
      input={
        mode === "generate" ? (
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <ToolbarSelect
                label={t("type")}
                value={type}
                onChange={setType}
                options={[
                  { value: "EC", label: "EC (ECDSA)" },
                  { value: "RSA", label: "RSA" },
                  { value: "Ed25519", label: "Ed25519" },
                ]}
              />
              {type === "RSA" && (
                <ToolbarSelect
                  label={t("size")}
                  value={String(rsaSize) as "2048" | "3072" | "4096"}
                  onChange={(v) => setRsaSize(Number(v) as RsaSize)}
                  options={[
                    { value: "2048", label: "2048 bits" },
                    { value: "3072", label: "3072 bits" },
                    { value: "4096", label: "4096 bits" },
                  ]}
                />
              )}
              {type === "EC" && (
                <ToolbarSelect
                  label={t("curve")}
                  value={curve}
                  onChange={setCurve}
                  options={[
                    { value: "P-256", label: "P-256 (ES256)" },
                    { value: "P-384", label: "P-384 (ES384)" },
                    { value: "P-521", label: "P-521 (ES512)" },
                  ]}
                />
              )}
            </div>
            <Button type="button" onClick={generate} disabled={generating}>
              {generating ? <LoaderCircle className="animate-spin" /> : <KeyRound />}
              {t("generateButton")}
            </Button>
            <p className="text-xs text-muted-foreground">{t("generateHint")}</p>
          </div>
        ) : (
          <CodeEditor value={input} onChange={setInput} ariaLabel={t("pemOrJwk")} placeholder={t("placeholder")} />
        )
      }
      output={
        mode === "generate" ? (
          pair ? (
            <div>
              <KeyBlock title={t("publicPem")} value={pair.publicPem} testId="public-pem" />
              <KeyBlock title={t("privatePem")} value={pair.privatePem} />
              <KeyBlock title={t("publicJwk")} value={JSON.stringify(pair.publicJwk, null, 2)} />
              <KeyBlock title={t("privateJwk")} value={JSON.stringify(pair.privateJwk, null, 2)} />
            </div>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">{t("pressGenerate")}</p>
          )
        ) : !converted ? (
          <p className="p-4 text-sm text-muted-foreground">{tc("emptyHint")}</p>
        ) : !converted.ok ? (
          <p role="alert" className="flex items-center gap-2 p-4 text-sm text-destructive">
            <CircleAlert className="size-4" aria-hidden />
            {t(`errors.${converted.error}`)}
          </p>
        ) : (
          <KeyBlock
            title={`${converted.output.startsWith("{") ? "JWK" : "PEM"} · ${t(converted.kind)}`}
            value={converted.output}
            testId="converted-key"
          />
        )
      }
    />
  );
}
