"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleAlert, CircleCheck, Clock, ShieldCheck, ShieldX } from "lucide-react";
import { useFormatter, useLocale, useNow, useTranslations } from "next-intl";
import { CodeEditor } from "@/components/shared/code-editor";
import { CopyButton } from "@/components/shared/copy-button";
import { ToolShell } from "@/components/shared/tool-shell";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDebounced } from "@/hooks/use-debounced";
import { useToolInput } from "@/hooks/use-tool-input";
import { decodeJwt, jwtStatus, timeClaims, type JwtStatus } from "@/lib/utils/jwt/decode";
import { isSymmetricAlg, verifyJwt, type VerifyResult } from "@/lib/utils/jwt/verify";
import { cn } from "cn";

// HS256, secret "kitforweb-secret", expires 2100-01-01.
const EXAMPLE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkYSBMb3ZlbGFjZSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTczNTY4OTYwMCwiZXhwIjo0MTAyNDQ0ODAwfQ.S-HTpGBysyhDx_Vwg45FNhQKJERrf5C_y_yL-pkwk3I";

function Section({ title, copy, children }: { title: string; copy?: string; children: React.ReactNode }) {
  return (
    <section className="border-b px-4 py-3 last:border-b-0">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">{title}</h3>
        {copy !== undefined && <CopyButton text={copy} size="icon-sm" />}
      </div>
      {children}
    </section>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="overflow-x-auto rounded-md bg-editor p-3 font-mono text-[13px] leading-6 text-foreground">
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}

const statusStyle: Record<JwtStatus, string> = {
  valid: "border-success/40 text-success",
  expired: "border-destructive/40 text-destructive",
  "not-yet-valid": "border-warning/40 text-warning",
  "no-expiry": "border-border text-muted-foreground",
};

export default function JwtDecoder() {
  const t = useTranslations("tools.jwt-decoder");
  const tc = useTranslations("common");
  const format = useFormatter();
  const locale = useLocale();
  const now = useNow({ updateInterval: 1000 });
  const [token, setToken] = useToolInput("jwt-decoder", "");
  const [key, setKey] = useState("");
  // Result is tagged with the inputs it belongs to, so stale results are ignored.
  const [checked, setChecked] = useState<{ input: string; result: VerifyResult } | null>(null);

  const decoded = useMemo(() => (token.trim() ? decodeJwt(token) : null), [token]);
  const jwt = decoded?.ok ? decoded.jwt : null;
  const alg = typeof jwt?.header.alg === "string" ? jwt.header.alg : "";
  const debouncedKey = useDebounced(key, 250);

  const verifyInput = jwt && debouncedKey && alg ? `${alg}\n${token}\n${debouncedKey}` : null;
  const verification = verifyInput && checked?.input === verifyInput ? checked.result : null;

  useEffect(() => {
    if (!verifyInput) return;
    let cancelled = false;
    void verifyJwt(token, alg, debouncedKey).then((result) => {
      if (!cancelled) setChecked({ input: verifyInput, result });
    });
    return () => {
      cancelled = true;
    };
  }, [verifyInput, token, alg, debouncedKey]);

  const status = jwt ? jwtStatus(jwt.payload, now) : null;
  const claims = jwt ? timeClaims(jwt.payload) : [];
  const exp = claims.find((c) => c.claim === "exp");

  return (
    <ToolShell
      toolId="jwt-decoder"
      inputLabel={t("token")}
      outputLabel={t("decoded")}
      defaultInputSize={40}
      onExample={() => {
        setToken(EXAMPLE);
        setKey("");
      }}
      onClear={() => {
        setToken("");
        setKey("");
      }}
      copyText={jwt ? () => JSON.stringify(jwt.payload, null, 2) : undefined}
      input={
        <div className="flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1">
            <CodeEditor
              value={token}
              onChange={setToken}
              lineWrapping
              ariaLabel={t("token")}
              placeholder={t("placeholder")}
            />
          </div>
          <div className="shrink-0 space-y-2 border-t bg-surface-1 p-3">
            <Label htmlFor="jwt-key" className="text-xs">
              {alg && isSymmetricAlg(alg) ? t("secret") : t("publicKey")}
            </Label>
            <Textarea
              id="jwt-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={alg && isSymmetricAlg(alg) ? t("secretPlaceholder") : t("publicKeyPlaceholder")}
              className="min-h-16 resize-y font-mono text-xs"
              spellCheck={false}
              autoComplete="off"
            />
            {verification && (
              <p
                role="status"
                className={cn("flex items-center gap-2 text-sm", verification.ok ? "text-success" : "text-destructive")}
              >
                {verification.ok ? (
                  <ShieldCheck className="size-4" aria-hidden />
                ) : (
                  <ShieldX className="size-4" aria-hidden />
                )}
                {verification.ok ? t("verified") : t(`verifyError.${verification.reason}`)}
              </p>
            )}
          </div>
        </div>
      }
      output={
        !decoded ? (
          <p className="p-4 text-sm text-muted-foreground">{tc("emptyHint")}</p>
        ) : !decoded.ok ? (
          <p role="alert" className="flex items-center gap-2 p-4 text-sm text-destructive">
            <CircleAlert className="size-4" aria-hidden />
            {t(`decodeError.${decoded.error}`)}
          </p>
        ) : (
          <div>
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
              {alg && (
                <Badge variant="outline" className="font-mono">
                  {alg}
                </Badge>
              )}
              {typeof jwt?.header.typ === "string" && (
                <Badge variant="outline" className="font-mono">
                  {jwt.header.typ}
                </Badge>
              )}
              {status && (
                <Badge variant="outline" className={cn("gap-1", statusStyle[status])} role="status">
                  {status === "valid" ? <CircleCheck aria-hidden /> : <Clock aria-hidden />}
                  {t(`status.${status}`, {
                    when: exp ? format.relativeTime(exp.date, now) : "",
                  })}
                </Badge>
              )}
            </div>
            <Section title={t("header")} copy={JSON.stringify(jwt!.header, null, 2)}>
              <JsonBlock value={jwt!.header} />
            </Section>
            <Section
              title={t("payload")}
              copy={typeof jwt!.payload === "string" ? jwt!.payload : JSON.stringify(jwt!.payload, null, 2)}
            >
              <JsonBlock value={jwt!.payload} />
              {claims.length > 0 && (
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  {claims.map((c) => (
                    <div key={c.claim} className="contents">
                      <dt className="font-mono text-accent-text">
                        {c.claim} <span className="text-muted-foreground">· {t(`claims.${c.claim}`)}</span>
                      </dt>
                      <dd>
                        <time dateTime={c.date.toISOString()}>
                          {c.date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "medium" })}
                        </time>{" "}
                        <span className="text-muted-foreground">({format.relativeTime(c.date, now)})</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </Section>
            <Section title={t("signature")} copy={jwt!.signature}>
              <p className="font-mono text-[13px] break-all text-muted-foreground">{jwt!.signature || t("unsigned")}</p>
            </Section>
          </div>
        )
      }
    />
  );
}
