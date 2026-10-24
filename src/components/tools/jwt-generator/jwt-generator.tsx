"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CircleAlert, KeyRound, ScanSearch } from "lucide-react";
import { useTranslations } from "next-intl";
import { CodeEditor } from "@/components/shared/code-editor";
import { CopyButton } from "@/components/shared/copy-button";
import { ToolShell } from "@/components/shared/tool-shell";
import { ToolbarField, ToolbarSelect, ToolbarSwitch } from "@/components/shared/toolbar-controls";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAppLocale } from "@/hooks/use-app-locale";
import { useDebounced } from "@/hooks/use-debounced";
import { useSettled } from "@/hooks/use-settled";
import { useToolInput } from "@/hooks/use-tool-input";
import { handoff } from "@/lib/handoff";
import { toolPath } from "@/lib/routes";
import { generateDemoKeys, isHmac, jwtAlgorithms, signJwt, type JwtAlgorithm } from "@/lib/utils/jwt/sign";

const EXAMPLE_PAYLOAD = `{
  "sub": "1234567890",
  "name": "Ada Lovelace",
  "role": "admin"
}`;

export default function JwtGenerator() {
  const t = useTranslations("tools.jwt-generator");
  const tc = useTranslations("common");
  const locale = useAppLocale();
  const router = useRouter();
  // Sensitive tool: useToolInput never persists it.
  const [payload, setPayload] = useToolInput("jwt-generator", "");
  const [alg, setAlg] = useState<JwtAlgorithm>("HS256");
  const [key, setKey] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [iat, setIat] = useState(true);
  const [expMinutes, setExpMinutes] = useState("60");
  const [kid, setKid] = useState("");
  const debouncedPayload = useDebounced(payload, 200);
  const debouncedKey = useDebounced(key, 200);

  const pending = useMemo(
    () =>
      debouncedPayload.trim()
        ? signJwt({
            alg,
            payload: debouncedPayload,
            key: debouncedKey,
            issuedAt: iat,
            expiresIn: Number(expMinutes) > 0 ? Number(expMinutes) * 60 : undefined,
            kid: kid.trim() || undefined,
          })
        : null,
    [alg, debouncedPayload, debouncedKey, iat, expMinutes, kid],
  );
  const { value: result } = useSettled(pending);
  const token = result?.ok ? result.token : "";

  const generateKey = async () => {
    const keys = await generateDemoKeys(alg);
    setKey(keys.privateKey);
    setPublicKey(keys.publicKey);
  };

  const [header, body, signature] = token.split(".");

  return (
    <ToolShell
      toolId="jwt-generator"
      inputLabel={t("payload")}
      outputLabel={t("token")}
      defaultInputSize={50}
      onExample={() => {
        setPayload(EXAMPLE_PAYLOAD);
        setAlg("HS256");
        setKey("kitforweb-secret");
      }}
      onClear={() => {
        setPayload("");
        setKey("");
        setPublicKey("");
      }}
      copyText={token}
      toolbar={
        <>
          <ToolbarSelect
            label={t("algorithm")}
            value={alg}
            onChange={(a) => {
              setAlg(a);
              // A key pair for another algorithm is useless.
              setPublicKey("");
            }}
            options={jwtAlgorithms.map((a) => ({ value: a, label: a }))}
          />
          <ToolbarSwitch label="iat" checked={iat} onChange={setIat} />
          <ToolbarField
            label={t("expMinutes")}
            type="number"
            min={0}
            width="w-20"
            value={expMinutes}
            onChange={setExpMinutes}
          />
          <ToolbarField label="kid" value={kid} onChange={setKid} width="w-24" />
        </>
      }
      input={
        <div className="flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1">
            <CodeEditor
              value={payload}
              onChange={setPayload}
              language="json"
              ariaLabel={t("payload")}
              placeholder={t("placeholder")}
            />
          </div>
          <div className="shrink-0 space-y-2 border-t bg-surface-1 p-3">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="jwt-sign-key" className="text-xs">
                {isHmac(alg) ? t("secret") : t("privateKey")}
              </Label>
              <Button type="button" variant="ghost" size="xs" onClick={generateKey}>
                <KeyRound />
                {isHmac(alg) ? t("generateSecret") : t("generateKeys")}
              </Button>
            </div>
            <Textarea
              id="jwt-sign-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={isHmac(alg) ? "your-256-bit-secret" : "-----BEGIN PRIVATE KEY-----"}
              className="min-h-16 resize-y font-mono text-xs"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
        </div>
      }
      output={
        !debouncedPayload.trim() ? (
          <p className="p-4 text-sm text-muted-foreground">{tc("emptyHint")}</p>
        ) : result && !result.ok ? (
          <p role="alert" className="flex items-center gap-2 p-4 text-sm text-destructive">
            <CircleAlert className="size-4" aria-hidden />
            {t(`errors.${result.error}`)}
          </p>
        ) : (
          <div className="space-y-4 p-4">
            <p data-testid="jwt-token" className="rounded-md bg-editor p-3 font-mono text-[13px] leading-6 break-all">
              <span className="text-[var(--syntax-keyword)]">{header}</span>.
              <span className="text-[var(--syntax-key)]">{body}</span>.
              <span className="text-[var(--syntax-string)]">{signature}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={token} variant="outline" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!token}
                onClick={() => {
                  handoff.put("jwt-decoder", token);
                  router.push(toolPath("jwt-decoder", locale));
                }}
              >
                <ScanSearch />
                {t("openDecoder")}
              </Button>
            </div>
            {publicKey && (
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase">{t("publicKey")}</h3>
                  <CopyButton text={publicKey} size="icon-sm" />
                </div>
                <pre className="overflow-x-auto rounded-md bg-editor p-3 font-mono text-xs">{publicKey}</pre>
                <p className="text-xs text-muted-foreground">{t("publicKeyHint")}</p>
              </section>
            )}
          </div>
        )
      }
    />
  );
}
