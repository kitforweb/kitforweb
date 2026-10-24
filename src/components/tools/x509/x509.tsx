"use client";

import { useMemo } from "react";
import { CircleAlert, CircleCheck, Clock } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { CodeEditor } from "@/components/shared/code-editor";
import { CopyButton } from "@/components/shared/copy-button";
import { FileDrop, FileOpenButton } from "@/components/shared/file-drop";
import { ToolShell } from "@/components/shared/tool-shell";
import { Badge } from "@/components/ui/badge";
import { useDebounced } from "@/hooks/use-debounced";
import { useSettled } from "@/hooks/use-settled";
import { useToolInput } from "@/hooks/use-tool-input";
import { parseCertificates, type CertInfo } from "@/lib/utils/crypto/x509";
import { cn } from "cn";

const EXAMPLE = `-----BEGIN CERTIFICATE-----
MIIBujCCAWGgAwIBAgIESx0sPjAKBggqhkjOPQQDAjA9MRowGAYDVQQDExFraXRm
b3J3ZWIuZXhhbXBsZTESMBAGA1UEChMJa2l0Zm9yd2ViMQswCQYDVQQGEwJFUzAe
Fw0yNjAxMDEwMDAwMDBaFw0zNjAxMDEwMDAwMDBaMD0xGjAYBgNVBAMTEWtpdGZv
cndlYi5leGFtcGxlMRIwEAYDVQQKEwlraXRmb3J3ZWIxCzAJBgNVBAYTAkVTMFkw
EwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEXKpbq1uSJZJtspeeJ4BsKgdOupHHgJAG
I+HcwV+0Cwk+SkT7NOrUAYi8TbXiIjk9MT9SZdAMLSbrC68ifKelYqNPME0wMwYD
VR0RBCwwKoIRa2l0Zm9yd2ViLmV4YW1wbGWCFXd3dy5raXRmb3J3ZWIuZXhhbXBs
ZTAJBgNVHRMEAjAAMAsGA1UdDwQEAwIHgDAKBggqhkjOPQQDAgNHADBEAiBVui3u
CIDzxtI+xLq/0zgDFfOuKMbUoWjTqo++ojgTHQIgJEWEZcTXcugQNRY+1inPcUYa
sTXyWpv2M2/86I64Nt0=
-----END CERTIFICATE-----`;

const statusStyle = {
  valid: "border-success/40 text-success",
  expired: "border-destructive/40 text-destructive",
  "not-yet-valid": "border-warning/40 text-warning",
} as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all">{children}</dd>
    </>
  );
}

function Certificate({ cert, index }: { cert: CertInfo; index: number }) {
  const t = useTranslations("tools.x509");
  const format = useFormatter();
  const soon = cert.status === "valid" && cert.daysLeft < 30;
  return (
    <article className="border-b p-4 last:border-b-0" aria-label={cert.commonName ?? cert.subject}>
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">#{index + 1}</span>
        <h3 className="font-heading text-sm font-semibold break-all">{cert.commonName ?? cert.subject}</h3>
        <Badge
          variant="outline"
          className={cn("gap-1", statusStyle[cert.status], soon && "border-warning/40 text-warning")}
        >
          {cert.status === "valid" ? <CircleCheck aria-hidden /> : <Clock aria-hidden />}
          {t(`status.${cert.status}`, { days: Math.abs(cert.daysLeft) })}
        </Badge>
        {cert.isCA && <Badge variant="outline">CA</Badge>}
        {cert.selfSigned && <Badge variant="outline">{t("selfSigned")}</Badge>}
      </header>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
        <Row label={t("subject")}>{cert.subject}</Row>
        <Row label={t("issuer")}>{cert.issuer}</Row>
        {cert.dnsNames.length + cert.ipAddresses.length > 0 && (
          <Row label={t("san")}>
            <ul className="flex flex-wrap gap-1">
              {[...cert.dnsNames, ...cert.ipAddresses].map((n) => (
                <li key={n}>
                  <Badge variant="secondary" className="font-mono">
                    {n}
                  </Badge>
                </li>
              ))}
            </ul>
          </Row>
        )}
        <Row label={t("validFrom")}>{format.dateTime(cert.notBefore, { dateStyle: "medium", timeStyle: "short" })}</Row>
        <Row label={t("validTo")}>{format.dateTime(cert.notAfter, { dateStyle: "medium", timeStyle: "short" })}</Row>
        <Row label={t("publicKey")}>
          {cert.publicKeyAlgorithm}
          {cert.publicKeySize ? ` · ${cert.publicKeySize} bits` : ""}
        </Row>
        <Row label={t("signature")}>{cert.signatureAlgorithm}</Row>
        <Row label={t("serial")}>
          <span className="font-mono">{cert.serialNumber}</span>
        </Row>
        {cert.keyUsages.length > 0 && <Row label={t("keyUsage")}>{cert.keyUsages.join(", ")}</Row>}
        <Row label="SHA-256">
          <span className="flex items-start gap-1">
            <span className="font-mono text-xs">{cert.sha256}</span>
            <CopyButton text={cert.sha256} size="icon-sm" />
          </span>
        </Row>
        <Row label="SHA-1">
          <span className="font-mono text-xs">{cert.sha1}</span>
        </Row>
      </dl>
    </article>
  );
}

export default function X509Tool() {
  const t = useTranslations("tools.x509");
  const tc = useTranslations("common");
  const [input, setInput] = useToolInput("x509", "");
  const debounced = useDebounced(input, 200);
  const parsing = useMemo(() => (debounced.trim() ? parseCertificates(debounced) : null), [debounced]);
  const { value: result } = useSettled(parsing);

  return (
    <ToolShell
      toolId="x509"
      inputLabel="certificate.pem"
      outputLabel={t("details")}
      defaultInputSize={40}
      onExample={() => setInput(EXAMPLE)}
      onClear={() => setInput("")}
      copyText={result?.ok ? JSON.stringify(result.certs, null, 2) : ""}
      inputActions={<FileOpenButton accept=".pem,.crt,.cer" onText={setInput} />}
      input={
        <FileDrop onText={setInput}>
          <CodeEditor value={input} onChange={setInput} ariaLabel="PEM" placeholder={t("placeholder")} />
        </FileDrop>
      }
      output={
        !result ? (
          <p className="p-4 text-sm text-muted-foreground">{tc("emptyHint")}</p>
        ) : !result.ok ? (
          <p role="alert" className="flex items-center gap-2 p-4 text-sm text-destructive">
            <CircleAlert className="size-4" aria-hidden />
            {result.error === "none" ? t("errors.none") : t("errors.invalid", { index: result.index ?? 1 })}
          </p>
        ) : (
          <div>
            {result.certs.map((c, i) => (
              <Certificate key={c.sha256} cert={c} index={i} />
            ))}
          </div>
        )
      }
    />
  );
}
