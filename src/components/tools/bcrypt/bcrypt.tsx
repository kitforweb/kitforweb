"use client";

import { useId, useMemo, useState } from "react";
import { CircleAlert, CircleCheck, CircleX, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { CopyButton } from "@/components/shared/copy-button";
import { ToolShell } from "@/components/shared/tool-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useDebounced } from "@/hooks/use-debounced";
import { useSettled } from "@/hooks/use-settled";
import {
  bcryptCompare,
  bcryptHash,
  exceedsBcryptLimit,
  MAX_COST,
  MIN_COST,
  parseBcrypt,
} from "@/lib/utils/crypto/bcrypt";

const EXAMPLE_PASSWORD = "correct horse battery staple";
const EXAMPLE_HASH = "$2b$10$WDHsS2e05u6fibtdF4fGpOLaoZCbgsENgQwk5ytDhrADLa89sOyYa";

function Field({
  label,
  value,
  onChange,
  mono = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={mono ? "font-mono text-sm" : undefined}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}

export default function BcryptTool() {
  const t = useTranslations("tools.bcrypt");
  const tc = useTranslations("common");
  // Sensitive tool: plain state, never persisted.
  const [password, setPassword] = useState("");
  const [cost, setCost] = useState(10);
  const [checkPassword, setCheckPassword] = useState("");
  const [checkHash, setCheckHash] = useState("");
  const pw = useDebounced(password, 300);
  const c = useDebounced(cost, 300);
  const cp = useDebounced(checkPassword, 300);
  const ch = useDebounced(checkHash, 300);

  const hashing = useMemo(() => (pw ? bcryptHash(pw, c) : null), [pw, c]);
  const { value: hashed, pending: hashPending } = useSettled(hashing);
  const comparing = useMemo(() => (cp && ch.trim() ? bcryptCompare(cp, ch) : null), [cp, ch]);
  const { value: compared, pending: comparePending } = useSettled(comparing);
  const parsed = ch.trim() ? parseBcrypt(ch) : null;

  return (
    <ToolShell
      toolId="bcrypt"
      inputLabel={t("hashTitle")}
      outputLabel={t("verifyTitle")}
      onExample={() => {
        setPassword(EXAMPLE_PASSWORD);
        setCheckPassword(EXAMPLE_PASSWORD);
        setCheckHash(EXAMPLE_HASH);
      }}
      onClear={() => {
        setPassword("");
        setCheckPassword("");
        setCheckHash("");
      }}
      copyText={hashed?.ok ? hashed.hash : ""}
      input={
        <div className="space-y-5 p-4">
          <Field label={t("password")} value={password} onChange={setPassword} />
          {exceedsBcryptLimit(password) && <p className="text-xs text-warning">{t("tooLong")}</p>}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <Label htmlFor="bcrypt-cost">{t("cost")}</Label>
              <output className="font-mono">
                {cost} · 2<sup>{cost}</sup> = {(2 ** cost).toLocaleString()} {t("rounds")}
              </output>
            </div>
            <Slider
              id="bcrypt-cost"
              min={MIN_COST}
              max={MAX_COST}
              step={1}
              value={[cost]}
              onValueChange={([v]) => setCost(v)}
              aria-label={t("cost")}
            />
            <p className="text-xs text-muted-foreground">{t("costHint")}</p>
          </div>
          <section className="space-y-2" aria-live="polite">
            {hashPending && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
                {tc("working")}
              </p>
            )}
            {hashed && !hashed.ok && <p className="text-sm text-destructive">{t(`errors.${hashed.error}`)}</p>}
            {hashed?.ok && (
              <div className="flex items-start gap-2">
                <p
                  data-testid="bcrypt-hash"
                  className="flex-1 rounded-md bg-editor p-3 font-mono text-[13px] break-all"
                >
                  {hashed.hash}
                </p>
                <CopyButton text={hashed.hash} size="icon-sm" />
              </div>
            )}
          </section>
        </div>
      }
      output={
        <div className="space-y-5 p-4">
          <Field label={t("password")} value={checkPassword} onChange={setCheckPassword} />
          <Field label={t("hash")} value={checkHash} onChange={setCheckHash} />
          {parsed && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
              <dt className="text-muted-foreground">{t("version")}</dt>
              <dd>${parsed.version}$</dd>
              <dt className="text-muted-foreground">{t("cost")}</dt>
              <dd>{parsed.cost}</dd>
              <dt className="text-muted-foreground">{t("salt")}</dt>
              <dd className="break-all">{parsed.salt}</dd>
            </dl>
          )}
          <div role="status" aria-live="polite">
            {comparePending && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
                {tc("working")}
              </p>
            )}
            {!comparePending && compared && !compared.ok && (
              <p className="flex items-center gap-2 text-sm text-destructive">
                <CircleAlert className="size-4" aria-hidden />
                {t("errors.hash")}
              </p>
            )}
            {!comparePending && compared?.ok && (
              <p className={`flex items-center gap-2 text-sm ${compared.match ? "text-success" : "text-destructive"}`}>
                {compared.match ? (
                  <CircleCheck className="size-4" aria-hidden />
                ) : (
                  <CircleX className="size-4" aria-hidden />
                )}
                {compared.match ? t("match") : t("noMatch")}
              </p>
            )}
          </div>
        </div>
      }
    />
  );
}
