"use client";

import { useId, useMemo, useState } from "react";
import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import { useTranslations } from "next-intl";
import { CopyButton } from "@/components/shared/copy-button";
import { ToolShell } from "@/components/shared/tool-shell";
import { ToolbarSelect } from "@/components/shared/toolbar-controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToolInput } from "@/hooks/use-tool-input";
import { cidrContains, parseCidr, splitCidr, type CidrInfo } from "@/lib/utils/infra/cidr";

const LIMIT = 256;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="contents">
      <dt className="py-1 text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1 py-1 font-mono break-all">
        {value}
        <CopyButton text={value} size="icon-sm" />
      </dd>
    </div>
  );
}

function Details({ info }: { info: CidrInfo }) {
  const t = useTranslations("tools.cidr");
  const n = (s: string) => (s.length > 15 ? s : Number(s).toLocaleString());
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 text-sm" data-testid="cidr-details">
      <Row label={t("fields.cidr")} value={`${info.network}/${info.prefix}`} />
      <Row label={t("fields.netmask")} value={info.netmask} />
      {info.wildcard && <Row label={t("fields.wildcard")} value={info.wildcard} />}
      <Row label={t("fields.first")} value={info.firstHost} />
      <Row label={t("fields.last")} value={info.lastHost} />
      {info.broadcast && <Row label={t("fields.broadcast")} value={info.broadcast} />}
      <Row label={t("fields.total")} value={n(info.total)} />
      <Row label={t("fields.usable")} value={n(info.usable)} />
      <div className="contents">
        <dt className="py-1 text-muted-foreground">{t("fields.scope")}</dt>
        <dd className="py-1">{t(`scopes.${info.scope}`)}</dd>
      </div>
      {info.binaryMask && <Row label={t("fields.binary")} value={info.binaryMask} />}
    </dl>
  );
}

export default function Cidr() {
  const t = useTranslations("tools.cidr");
  const ipId = useId();
  const [text, setText] = useToolInput("cidr", "");
  const [probe, setProbe] = useState("");
  const [split, setSplit] = useState("none");

  const result = useMemo(() => (text.trim() ? parseCidr(text) : null), [text]);
  const info = result?.ok ? result.info : null;
  const contains = useMemo(() => (info && probe.trim() ? cidrContains(info, probe) : null), [info, probe]);
  const bits = info?.version === 6 ? 128 : 32;
  const splitPrefix = Number(split);
  const subnets = useMemo(
    () => (info && splitPrefix > info.prefix ? splitCidr(info, splitPrefix, LIMIT) : null),
    [info, splitPrefix],
  );
  const splitOptions = info
    ? Array.from({ length: Math.min(bits - info.prefix, 16) }, (_, i) => String(info.prefix + i + 1))
    : [];

  return (
    <ToolShell
      toolId="cidr"
      inputLabel={t("block")}
      outputLabel={t("details")}
      onExample={() => {
        setText("10.20.0.0/22");
        setProbe("10.20.3.17");
        setSplit("24");
      }}
      onClear={() => {
        setText("");
        setProbe("");
        setSplit("none");
      }}
      copyText={info ? `${info.network}/${info.prefix}` : ""}
      input={
        <div className="space-y-5 p-4">
          <div className="space-y-1">
            <Label htmlFor={`${ipId}-cidr`} className="text-xs">
              {t("block")}
            </Label>
            <Input
              id={`${ipId}-cidr`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="192.168.1.0/24"
              className="font-mono"
              spellCheck={false}
            />
            {result && !result.ok && (
              <p role="alert" className="flex items-center gap-2 pt-1 text-sm text-destructive">
                <CircleAlert className="size-4" aria-hidden />
                {t(`errors.${result.error}`)}
              </p>
            )}
            {info?.normalized && (
              <p className="pt-1 text-xs text-warning">{t("normalized", { network: info.network })}</p>
            )}
          </div>
          <div className="space-y-1 border-t pt-4">
            <Label htmlFor={`${ipId}-probe`} className="text-xs">
              {t("contains")}
            </Label>
            <Input
              id={`${ipId}-probe`}
              value={probe}
              onChange={(e) => setProbe(e.target.value)}
              placeholder="192.168.1.42"
              className="font-mono"
              spellCheck={false}
              disabled={!info}
            />
            <div role="status" aria-live="polite" data-testid="cidr-contains">
              {contains &&
                (!contains.ok ? (
                  <p className="pt-1 text-sm text-destructive">{t(`errors.${contains.error}`)}</p>
                ) : contains.contains ? (
                  <p className="flex items-center gap-2 pt-1 text-sm text-success">
                    <CircleCheck className="size-4" aria-hidden />
                    {t("inside", { ip: probe.trim() })}
                  </p>
                ) : (
                  <p className="flex items-center gap-2 pt-1 text-sm text-destructive">
                    <CircleX className="size-4" aria-hidden />
                    {t("outside", { ip: probe.trim() })}
                  </p>
                ))}
            </div>
          </div>
          {info && splitOptions.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <ToolbarSelect
                label={t("split")}
                value={split}
                onChange={setSplit}
                options={[{ value: "none", label: "—" }, ...splitOptions.map((p) => ({ value: p, label: `/${p}` }))]}
              />
              {subnets && (
                <>
                  <p className="text-xs text-muted-foreground">
                    {t("subnets", {
                      count: Number(subnets.total) || 0,
                      shown: subnets.subnets.length,
                      truncated: subnets.subnets.length < Number(subnets.total) ? "yes" : "no",
                    })}
                  </p>
                  <ol className="max-h-64 overflow-auto rounded-md border font-mono text-xs" data-testid="cidr-subnets">
                    {subnets.subnets.map((s) => (
                      <li key={s} className="border-b px-2 py-1 last:border-b-0">
                        {s}
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </div>
          )}
        </div>
      }
      output={
        info ? (
          <div className="p-4">
            <Details info={info} />
          </div>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">{t("hint")}</p>
        )
      }
    />
  );
}
