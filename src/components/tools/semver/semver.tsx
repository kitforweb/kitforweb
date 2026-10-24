"use client";

import { useId, useMemo, useState } from "react";
import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import { useTranslations } from "next-intl";
import { CopyButton } from "@/components/shared/copy-button";
import { ToolShell } from "@/components/shared/tool-shell";
import { Segmented, ToolbarSwitch } from "@/components/shared/toolbar-controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToolInput } from "@/hooks/use-tool-input";
import { checkRange, sortVersions } from "@/lib/utils/http/semver";

const OPERATORS = ["^", "~", ">=", "<", "x", "||", "-"] as const;

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono"
        spellCheck={false}
      />
    </div>
  );
}

export default function Semver() {
  const t = useTranslations("tools.semver");
  // The detector hands off versions or ranges: they land in the range field.
  const [range, setRange] = useToolInput("semver", "");
  const [version, setVersion] = useState("");
  const [pre, setPre] = useState(false);
  const [list, setList] = useState("");
  const [order, setOrder] = useState<"asc" | "desc">("asc");

  const check = useMemo(
    () => (range.trim() && version.trim() ? checkRange(version, range, pre) : null),
    [version, range, pre],
  );
  const sorted = useMemo(
    () => (list.trim() ? sortVersions(list.split(/\r?\n|,/), order === "desc") : null),
    [list, order],
  );

  return (
    <ToolShell
      toolId="semver"
      inputLabel={t("check")}
      outputLabel={t("sortTitle")}
      onExample={() => {
        setRange("^1.2.3");
        setVersion("1.4.0");
        setList("1.10.0\n1.2.0\nv1.9.3\n2.0.0-rc.1\n1.2.0-beta.2\n0.9.12");
      }}
      onClear={() => {
        setRange("");
        setVersion("");
        setList("");
      }}
      copyText={sorted?.sorted.join("\n") ?? ""}
      toolbar={<ToolbarSwitch label={t("prerelease")} checked={pre} onChange={setPre} />}
      input={
        <div className="space-y-5 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("version")} value={version} onChange={setVersion} />
            <Field label={t("range")} value={range} onChange={setRange} />
          </div>
          <div role="status" aria-live="polite">
            {check &&
              (!check.ok ? (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  <CircleAlert className="size-4" aria-hidden />
                  {t(`errors.${check.error}`)}
                </p>
              ) : (
                <div className="space-y-3" data-testid="semver-check">
                  <p
                    className={`flex items-center gap-2 text-lg ${check.satisfies ? "text-success" : "text-destructive"}`}
                  >
                    {check.satisfies ? (
                      <CircleCheck className="size-5" aria-hidden />
                    ) : (
                      <CircleX className="size-5" aria-hidden />
                    )}
                    {t(check.satisfies ? "satisfies" : "notSatisfies", {
                      version: version.trim(),
                      range: range.trim(),
                    })}
                  </p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">{t("meaning")}</dt>
                    <dd className="font-mono">{check.comparators.map((c) => c.join(" ")).join("  ||  ")}</dd>
                    <dt className="text-muted-foreground">{t("min")}</dt>
                    <dd className="font-mono">{check.min ?? "—"}</dd>
                  </dl>
                </div>
              ))}
          </div>
          <section className="space-y-2 border-t pt-4">
            <h3 className="text-xs font-semibold text-muted-foreground">{t("cheatSheet")}</h3>
            <dl className="grid grid-cols-[4rem_1fr] gap-x-3 gap-y-1.5 text-sm">
              {OPERATORS.map((op) => (
                <div key={op} className="contents">
                  <dt className="font-mono text-accent-text">{op}</dt>
                  <dd className="text-muted-foreground">{t(`operators.${op}`)}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      }
      output={
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="semver-list" className="text-xs">
              {t("listLabel")}
            </Label>
            <Segmented
              label={t("order")}
              value={order}
              onChange={setOrder}
              options={[
                { value: "asc", label: t("asc") },
                { value: "desc", label: t("desc") },
              ]}
            />
          </div>
          <Textarea
            id="semver-list"
            value={list}
            onChange={(e) => setList(e.target.value)}
            placeholder={"1.10.0\n1.2.0\n1.9.3"}
            className="min-h-28 font-mono text-[13px]"
            spellCheck={false}
          />
          {sorted && (
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <ol
                  className="flex-1 rounded-md bg-editor p-3 font-mono text-[13px] leading-6"
                  data-testid="semver-sorted"
                >
                  {sorted.sorted.map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ol>
                <CopyButton text={sorted.sorted.join("\n")} size="icon-sm" />
              </div>
              {sorted.invalid.length > 0 && (
                <p className="text-xs text-warning">{t("invalidList", { list: sorted.invalid.join(", ") })}</p>
              )}
            </div>
          )}
        </div>
      }
    />
  );
}
