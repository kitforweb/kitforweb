"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { CopyButton } from "@/components/shared/copy-button";
import { ToolShell } from "@/components/shared/tool-shell";
import { Segmented, ToolbarField, ToolbarSwitch } from "@/components/shared/toolbar-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { generatePassword, generateSecret, strength, type SecretFormat } from "@/lib/utils/crypto/password";
import { cn } from "cn";

const strengthStyle = {
  weak: "bg-destructive w-1/4",
  fair: "bg-warning w-2/4",
  strong: "bg-success w-3/4",
  "very-strong": "bg-success w-full",
} as const;

export default function PasswordGenerator() {
  const t = useTranslations("tools.password-generator");
  const [length, setLength] = useState(20);
  const [sets, setSets] = useState({ lower: true, upper: true, digits: true, symbols: true });
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(false);
  const [count, setCount] = useState("5");
  const [bytes, setBytes] = useState("32");
  const [format, setFormat] = useState<SecretFormat>("hex");
  const [envName, setEnvName] = useState("SECRET_KEY");
  const [seed, setSeed] = useState(0);

  // `seed` only forces a new batch when "Regenerate" is pressed.
  const passwords = useMemo(
    () =>
      Array.from({ length: Math.max(1, Math.min(50, Number(count) || 1)) }, () =>
        generatePassword({ length, excludeAmbiguous, ...sets }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [length, sets, excludeAmbiguous, count, seed],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const secret = useMemo(() => generateSecret(Number(bytes) || 32, format), [bytes, format, seed]);
  const first = passwords[0];
  const envLine = `${envName.trim() || "SECRET_KEY"}=${secret}`;

  const toggle = (key: keyof typeof sets) => (v: boolean) => setSets((s) => ({ ...s, [key]: v }));

  return (
    <ToolShell
      toolId="password-generator"
      inputLabel={t("options")}
      outputLabel={t("passwords")}
      defaultInputSize={40}
      onExample={() => {
        setLength(24);
        setSets({ lower: true, upper: true, digits: true, symbols: true });
        setExcludeAmbiguous(true);
      }}
      onClear={() => setSeed((s) => s + 1)}
      copyText={first?.ok ? first.password : ""}
      toolbar={
        <Button type="button" variant="ghost" size="sm" onClick={() => setSeed((s) => s + 1)}>
          <RefreshCw />
          {t("regenerate")}
        </Button>
      }
      input={
        <div className="space-y-5 p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <Label htmlFor="pw-length">{t("length")}</Label>
              <output className="font-mono" data-testid="pw-length">
                {length}
              </output>
            </div>
            <Slider
              id="pw-length"
              min={4}
              max={128}
              step={1}
              value={[length]}
              onValueChange={([v]) => setLength(v)}
              aria-label={t("length")}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ToolbarSwitch label="a–z" checked={sets.lower} onChange={toggle("lower")} />
            <ToolbarSwitch label="A–Z" checked={sets.upper} onChange={toggle("upper")} />
            <ToolbarSwitch label="0–9" checked={sets.digits} onChange={toggle("digits")} />
            <ToolbarSwitch label="!@#$" checked={sets.symbols} onChange={toggle("symbols")} />
          </div>
          <ToolbarSwitch label={t("excludeAmbiguous")} checked={excludeAmbiguous} onChange={setExcludeAmbiguous} />
          <ToolbarField
            label={t("count")}
            type="number"
            min={1}
            max={50}
            width="w-20"
            value={count}
            onChange={setCount}
          />

          <section className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-medium">{t("secretTitle")}</h3>
            <p className="text-xs text-muted-foreground">{t("secretHint")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <ToolbarField
                label={t("bytes")}
                type="number"
                min={8}
                max={256}
                width="w-20"
                value={bytes}
                onChange={setBytes}
              />
              <Segmented
                label={t("format")}
                value={format}
                onChange={setFormat}
                options={[
                  { value: "hex", label: "hex" },
                  { value: "base64", label: "base64" },
                  { value: "base64url", label: "base64url" },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="env-name" className="text-xs">
                {t("envName")}
              </Label>
              <Input
                id="env-name"
                value={envName}
                onChange={(e) => setEnvName(e.target.value)}
                className="h-8 font-mono text-xs"
              />
            </div>
            <div className="flex items-start gap-2">
              <code data-testid="env-line" className="flex-1 rounded-md bg-editor p-2 font-mono text-xs break-all">
                {envLine}
              </code>
              <CopyButton text={envLine} size="icon-sm" />
            </div>
          </section>
        </div>
      }
      output={
        !first?.ok ? (
          <p role="alert" className="p-4 text-sm text-destructive">
            {t(`errors.${first?.ok === false ? first.error : "sets"}`)}
          </p>
        ) : (
          <div>
            <div className="space-y-1.5 border-b px-3 py-3" role="status">
              <div className="flex items-center justify-between text-xs">
                <span>{t(`strength.${strength(first.entropy)}`)}</span>
                <span className="font-mono text-muted-foreground">{t("entropy", { bits: first.entropy })}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full transition-all", strengthStyle[strength(first.entropy)])} />
              </div>
            </div>
            <ul aria-label={t("passwords")} data-testid="password-list">
              {passwords.map((p, i) =>
                p.ok ? (
                  <li key={i} className="flex items-center gap-2 border-b px-3 py-2 last:border-b-0">
                    <span className="flex-1 font-mono text-[13px] break-all">{p.password}</span>
                    <CopyButton text={p.password} size="icon-sm" />
                  </li>
                ) : null,
              )}
            </ul>
          </div>
        )
      }
    />
  );
}
