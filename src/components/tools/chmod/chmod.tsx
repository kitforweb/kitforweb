"use client";

import { useId, useMemo, useState } from "react";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { CopyButton } from "@/components/shared/copy-button";
import { ToolShell } from "@/components/shared/tool-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToolInput } from "@/hooks/use-tool-input";
import {
  applySymbolic,
  BITS,
  CLASSES,
  fromOctal,
  parseChmodInput,
  PRESETS,
  risks,
  symbolicExpression,
  toOctal,
  toSymbolic,
  type Permissions,
} from "@/lib/utils/infra/chmod";

const EMPTY = fromOctal(0);

function Grid({ perms, onChange }: { perms: Permissions; onChange: (p: Permissions) => void }) {
  const t = useTranslations("tools.chmod");
  const toggle = (cls: (typeof CLASSES)[number], bit: (typeof BITS)[number]) =>
    onChange({ ...perms, [cls]: { ...perms[cls], [bit]: !perms[cls][bit] } });
  const special = (key: "setuid" | "setgid" | "sticky") => onChange({ ...perms, [key]: !perms[key] });
  return (
    <table className="w-full text-sm" data-testid="chmod-grid">
      <thead>
        <tr className="text-xs text-muted-foreground">
          <th className="py-1 text-start font-normal" />
          {BITS.map((b) => (
            <th key={b} className="py-1 font-normal">
              {t(`bits.${b}`)}
            </th>
          ))}
          <th className="py-1 font-normal">{t("special")}</th>
        </tr>
      </thead>
      <tbody>
        {CLASSES.map((cls) => {
          const key = cls === "user" ? "setuid" : cls === "group" ? "setgid" : "sticky";
          return (
            <tr key={cls} className="border-t">
              <th scope="row" className="py-2 text-start font-medium">
                {t(`classes.${cls}`)}
              </th>
              {BITS.map((bit) => (
                <td key={bit} className="text-center">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                    checked={perms[cls][bit]}
                    onChange={() => toggle(cls, bit)}
                    aria-label={`${t(`classes.${cls}`)} · ${t(`bits.${bit}`)}`}
                  />
                </td>
              ))}
              <td className="text-center">
                <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                    checked={perms[key]}
                    onChange={() => special(key)}
                  />
                  {t(`specials.${key}`)}
                </label>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function Chmod() {
  const t = useTranslations("tools.chmod");
  const id = useId();
  const [text, setText] = useToolInput("chmod", "");
  const [expr, setExpr] = useState("");

  const parsed = useMemo(() => (text.trim() ? parseChmodInput(text) : null), [text]);
  const perms = parsed?.ok ? parsed.perms : EMPTY;
  const octal = toOctal(perms);
  const symbolic = toSymbolic(perms);
  const target = (parsed?.ok && parsed.target) || "file";
  const recursive = parsed?.ok && parsed.recursive ? "-R " : "";
  const applied = expr.trim() ? applySymbolic(perms, expr) : null;
  const warnings = risks(perms);

  const commands = [`chmod ${recursive}${octal} ${target}`, `chmod ${recursive}${symbolicExpression(perms)} ${target}`];

  return (
    <ToolShell
      toolId="chmod"
      inputLabel={t("permissions")}
      outputLabel={t("result")}
      onExample={() => {
        setText("chmod -R 750 /srv/app");
        setExpr("g+w");
      }}
      onClear={() => {
        setText("");
        setExpr("");
      }}
      copyText={octal}
      input={
        <div className="space-y-5 p-4">
          <div className="space-y-1">
            <Label htmlFor={`${id}-mode`} className="text-xs">
              {t("mode")}
            </Label>
            <Input
              id={`${id}-mode`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="755 · rwxr-xr-x · chmod 644 file"
              className="font-mono"
              spellCheck={false}
            />
            {parsed && !parsed.ok && (
              <p role="alert" className="flex items-center gap-2 pt-1 text-sm text-destructive">
                <CircleAlert className="size-4" aria-hidden />
                {t("invalid")}
              </p>
            )}
            {parsed?.ok && parsed.source === "expression" && (
              <p className="pt-1 text-xs text-muted-foreground">{t("relative")}</p>
            )}
          </div>
          <Grid perms={perms} onChange={(p) => setText(toOctal(p))} />
          <div className="space-y-1 border-t pt-4">
            <Label htmlFor={`${id}-expr`} className="text-xs">
              {t("expression")}
            </Label>
            <div className="flex gap-2">
              <Input
                id={`${id}-expr`}
                value={expr}
                onChange={(e) => setExpr(e.target.value)}
                placeholder="u+x,go-w"
                className="font-mono"
                spellCheck={false}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={!applied}
                onClick={() => applied && setText(toOctal(applied))}
              >
                {t("apply")}
              </Button>
            </div>
            {expr.trim() && (
              <p className="pt-1 font-mono text-xs text-muted-foreground" data-testid="chmod-preview">
                {applied ? `${octal} → ${toOctal(applied)} (${toSymbolic(applied)})` : t("invalidExpression")}
              </p>
            )}
          </div>
          <div className="space-y-2 border-t pt-4">
            <h3 className="text-xs font-semibold text-muted-foreground">{t("presets")}</h3>
            <ul className="space-y-1">
              {PRESETS.map((p) => (
                <li key={p}>
                  <button
                    type="button"
                    onClick={() => setText(p)}
                    className="flex w-full items-baseline gap-3 rounded px-2 py-1 text-start text-sm hover:bg-muted"
                  >
                    <span className="w-10 font-mono text-accent-text">{p}</span>
                    <span className="w-24 font-mono text-xs text-muted-foreground">
                      {toSymbolic(fromOctal(parseInt(p, 8)))}
                    </span>
                    <span className="text-muted-foreground">{t(`presetUse.${p}`)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      }
      output={
        <div className="space-y-5 p-4" data-testid="chmod-result">
          <div className="flex flex-wrap items-end gap-8">
            <div>
              <p className="text-xs text-muted-foreground">{t("octal")}</p>
              <p className="flex items-center gap-1 font-mono text-4xl" data-testid="chmod-octal">
                {octal}
                <CopyButton text={octal} size="icon-sm" />
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("symbolic")}</p>
              <p className="flex items-center gap-1 font-mono text-2xl" data-testid="chmod-symbolic">
                {symbolic}
                <CopyButton text={symbolic} size="icon-sm" />
              </p>
            </div>
          </div>
          <section className="space-y-1">
            <h3 className="text-xs font-semibold text-muted-foreground">{t("commands")}</h3>
            {commands.map((c) => (
              <p key={c} className="flex items-center gap-1 rounded-md bg-editor px-2 py-1 font-mono text-sm">
                <span className="flex-1 break-all">{c}</span>
                <CopyButton text={c} size="icon-sm" />
              </p>
            ))}
          </section>
          <section className="space-y-1 text-sm">
            <h3 className="text-xs font-semibold text-muted-foreground">{t("meaning")}</h3>
            <ul className="space-y-0.5">
              {CLASSES.map((cls) => {
                const granted = BITS.filter((b) => perms[cls][b]).map((b) => t(`bits.${b}`).toLowerCase());
                return (
                  <li key={cls}>
                    <span className="font-medium">{t(`classes.${cls}`)}:</span>{" "}
                    {granted.length > 0 ? granted.join(", ") : t("nothing")}
                  </li>
                );
              })}
            </ul>
          </section>
          {warnings.length > 0 && (
            <ul className="space-y-1" data-testid="chmod-risks">
              {warnings.map((w) => (
                <li key={w} className="flex items-start gap-2 text-sm text-warning">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {t(`risks.${w}`)}
                </li>
              ))}
            </ul>
          )}
        </div>
      }
    />
  );
}
