"use client";

import { useMemo, useState } from "react";
import { CircleAlert, RefreshCw } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { ToolShell } from "@/components/shared/tool-shell";
import { Segmented, ToolbarField, ToolbarSwitch } from "@/components/shared/toolbar-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateUuids, inspectUuid, type UuidVersion } from "@/lib/utils/crypto/uuid";

const SAMPLE = "0190a5b8-6e1f-7c3a-9b2d-4e5f6a7b8c9d";

export default function UuidTool() {
  const t = useTranslations("tools.uuid");
  const format = useFormatter();
  const [version, setVersion] = useState<UuidVersion>(4);
  const [count, setCount] = useState("5");
  const [uppercase, setUppercase] = useState(false);
  const [hyphens, setHyphens] = useState(true);
  const [braces, setBraces] = useState(false);
  const [seed, setSeed] = useState(0);
  const [check, setCheck] = useState("");

  // `seed` only forces a new batch when "Regenerate" is pressed.
  const ids = useMemo(
    () => generateUuids(version, Number(count), { uppercase, hyphens, braces }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, count, uppercase, hyphens, braces, seed],
  );
  const info = check.trim() ? inspectUuid(check) : null;

  return (
    <ToolShell
      toolId="uuid"
      inputLabel={t("inspector")}
      outputLabel={t("generated")}
      defaultInputSize={40}
      onExample={() => {
        setCheck(SAMPLE);
        setVersion(7);
      }}
      onClear={() => setCheck("")}
      copyText={ids.join("\n")}
      toolbar={
        <>
          <Segmented
            label={t("version")}
            value={String(version) as "4" | "7"}
            onChange={(v) => setVersion(Number(v) as UuidVersion)}
            options={[
              { value: "4", label: "v4" },
              { value: "7", label: "v7" },
            ]}
          />
          <ToolbarField
            label={t("count")}
            type="number"
            min={1}
            max={1000}
            width="w-20"
            value={count}
            onChange={setCount}
          />
          <ToolbarSwitch label={t("uppercase")} checked={uppercase} onChange={setUppercase} />
          <ToolbarSwitch label={t("hyphens")} checked={hyphens} onChange={setHyphens} />
          <ToolbarSwitch label="{ }" checked={braces} onChange={setBraces} />
          <Button type="button" variant="ghost" size="sm" onClick={() => setSeed((s) => s + 1)}>
            <RefreshCw />
            {t("regenerate")}
          </Button>
        </>
      }
      input={
        <div className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="uuid-check" className="text-xs">
              {t("paste")}
            </Label>
            <Input
              id="uuid-check"
              value={check}
              onChange={(e) => setCheck(e.target.value)}
              placeholder="xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx"
              className="font-mono text-sm"
              spellCheck={false}
            />
          </div>
          {check.trim() &&
            (info ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm" data-testid="uuid-info">
                <dt className="text-muted-foreground">{t("valid")}</dt>
                <dd className="font-mono text-success">{info.canonical}</dd>
                <dt className="text-muted-foreground">{t("version")}</dt>
                <dd>{info.special ? t(info.special) : t("versionN", { n: info.version })}</dd>
                <dt className="text-muted-foreground">{t("variant")}</dt>
                <dd>{info.variant}</dd>
                {info.timestamp && (
                  <>
                    <dt className="text-muted-foreground">{t("created")}</dt>
                    <dd>
                      <time dateTime={info.timestamp.toISOString()}>
                        {format.dateTime(info.timestamp, { dateStyle: "medium", timeStyle: "medium" })}
                      </time>
                    </dd>
                  </>
                )}
                <dt className="text-muted-foreground">{t("about")}</dt>
                <dd className="text-xs text-muted-foreground">
                  {t.has(`versions.${info.version}`) ? t(`versions.${info.version}`) : "—"}
                </dd>
              </dl>
            ) : (
              <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
                <CircleAlert className="size-4" aria-hidden />
                {t("invalid")}
              </p>
            ))}
        </div>
      }
      output={
        <ol className="p-3 font-mono text-[13px] leading-7" aria-label={t("generated")} data-testid="uuid-list">
          {ids.map((id) => (
            <li key={id} className="break-all">
              {id}
            </li>
          ))}
        </ol>
      }
    />
  );
}
