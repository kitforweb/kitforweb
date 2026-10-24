"use client";

import { useMemo, useState } from "react";
import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import { useTranslations } from "next-intl";
import { CodeEditor } from "@/components/shared/code-editor";
import { CopyButton } from "@/components/shared/copy-button";
import { ToolShell } from "@/components/shared/tool-shell";
import { ToolbarSelect } from "@/components/shared/toolbar-controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebounced } from "@/hooks/use-debounced";
import { useSettled } from "@/hooks/use-settled";
import { useToolInput } from "@/hooks/use-tool-input";
import { hmac, signatureMatches, type HmacAlgorithm, type KeyEncoding } from "@/lib/utils/crypto/hmac";

const EXAMPLE_MESSAGE = '{"event":"payment.succeeded","id":"evt_123"}';

export default function HmacTool() {
  const t = useTranslations("tools.hmac");
  const tc = useTranslations("common");
  const [message, setMessage] = useToolInput("hmac", "");
  const [key, setKey] = useState("");
  const [algorithm, setAlgorithm] = useState<HmacAlgorithm>("SHA-256");
  const [encoding, setEncoding] = useState<KeyEncoding>("utf8");
  const [expected, setExpected] = useState("");
  const m = useDebounced(message, 150);
  const k = useDebounced(key, 150);

  const pending = useMemo(() => (m ? hmac(m, k, algorithm, encoding) : null), [m, k, algorithm, encoding]);
  const { value: result } = useSettled(pending);

  return (
    <ToolShell
      toolId="hmac"
      inputLabel={t("message")}
      outputLabel={t("signature")}
      onExample={() => {
        setMessage(EXAMPLE_MESSAGE);
        setKey("whsec_test_secret");
        setEncoding("utf8");
        setAlgorithm("SHA-256");
      }}
      onClear={() => {
        setMessage("");
        setKey("");
        setExpected("");
      }}
      copyText={result?.ok ? result.hex : ""}
      toolbar={
        <>
          <ToolbarSelect
            label={t("algorithm")}
            value={algorithm}
            onChange={setAlgorithm}
            options={(["SHA-256", "SHA-384", "SHA-512", "SHA-1"] as const).map((a) => ({
              value: a,
              label: `HMAC-${a}`,
            }))}
          />
          <ToolbarSelect
            label={t("keyEncoding")}
            value={encoding}
            onChange={setEncoding}
            options={[
              { value: "utf8", label: t("keyText") },
              { value: "hex", label: t("keyHex") },
              { value: "base64", label: t("keyBase64") },
            ]}
          />
        </>
      }
      input={
        <div className="flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1">
            <CodeEditor
              value={message}
              onChange={setMessage}
              lineWrapping
              ariaLabel={t("message")}
              placeholder={t("placeholder")}
            />
          </div>
          <div className="grid shrink-0 gap-3 border-t bg-surface-1 p-3">
            <div className="space-y-1.5">
              <Label htmlFor="hmac-key" className="text-xs">
                {t("key")}
              </Label>
              <Input
                id="hmac-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="h-8 font-mono text-xs"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hmac-expected" className="text-xs">
                {t("expected")}
              </Label>
              <Input
                id="hmac-expected"
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
                placeholder="sha256=… / t=…,v1=…"
                className="h-8 font-mono text-xs"
                spellCheck={false}
              />
            </div>
          </div>
        </div>
      }
      output={
        !result ? (
          <p className="p-4 text-sm text-muted-foreground">{tc("emptyHint")}</p>
        ) : !result.ok ? (
          <p role="alert" className="flex items-center gap-2 p-4 text-sm text-destructive">
            <CircleAlert className="size-4" aria-hidden />
            {t("invalidKey")}
          </p>
        ) : (
          <div>
            {expected.trim() &&
              (signatureMatches(expected, result) ? (
                <p role="status" className="flex items-center gap-2 border-b px-3 py-2 text-sm text-success">
                  <CircleCheck className="size-4" aria-hidden />
                  {t("valid")}
                </p>
              ) : (
                <p role="status" className="flex items-center gap-2 border-b px-3 py-2 text-sm text-destructive">
                  <CircleX className="size-4" aria-hidden />
                  {t("invalid")}
                </p>
              ))}
            {(["hex", "base64"] as const).map((f) => (
              <section key={f} className="space-y-1 border-b px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-mono text-xs font-semibold text-accent-text">{f === "hex" ? "Hex" : "Base64"}</h3>
                  <CopyButton text={result[f]} size="icon-sm" />
                </div>
                <p data-testid={`hmac-${f}`} className="font-mono text-[13px] break-all">
                  {result[f]}
                </p>
              </section>
            ))}
          </div>
        )
      }
    />
  );
}
