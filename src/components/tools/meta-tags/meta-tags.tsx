"use client";

import { useId, useMemo } from "react";
import { useTranslations } from "next-intl";
import { CodeEditor } from "@/components/shared/code-editor";
import { ToolShell } from "@/components/shared/tool-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToolInput } from "@/hooks/use-tool-input";
import {
  breadcrumbUrl,
  generateMetaTags,
  hostname,
  lengthStatus,
  LIMITS,
  truncate,
  type LengthStatus,
  type MetaInput,
} from "@/lib/utils/http/meta";
import { cn } from "cn";

const EMPTY: MetaInput = {
  title: "",
  description: "",
  url: "",
  image: "",
  siteName: "",
  type: "website",
  twitterSite: "",
  locale: "",
};

const EXAMPLE: MetaInput = {
  title: "kitforweb · Free web developer tools that never see your data",
  description:
    "Format JSON, decode JWTs, build fluid CSS or draw diagrams. Every tool runs 100% in your browser, so you can paste production data without fear.",
  url: "https://kitforweb.com/en",
  image: "https://kitforweb.com/en/opengraph-image",
  siteName: "kitforweb",
  type: "website",
  twitterSite: "kitforweb",
  locale: "en_US",
};

const STATUS_STYLE: Record<LengthStatus, string> = {
  empty: "text-muted-foreground",
  short: "text-warning",
  ok: "text-success",
  long: "text-destructive",
};

function parse(json: string): MetaInput {
  try {
    return { ...EMPTY, ...(JSON.parse(json) as Partial<MetaInput>) };
  } catch {
    return EMPTY;
  }
}

function Field({
  label,
  value,
  onChange,
  max,
  multiline,
  status,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
  multiline?: boolean;
  status?: LengthStatus;
}) {
  const id = useId();
  const t = useTranslations("tools.meta-tags");
  const count = [...value].length;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-xs">
          {label}
        </Label>
        {max && status && (
          <span className={cn("font-mono text-[11px]", STATUS_STYLE[status])} aria-live="polite">
            {count}/{max} {status !== "ok" && status !== "empty" ? `· ${t(`status.${status}`)}` : ""}
          </span>
        )}
      </div>
      {multiline ? (
        <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-16 text-sm" />
      ) : (
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-sm" />
      )}
    </div>
  );
}

function Preview({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

export default function MetaTags() {
  const t = useTranslations("tools.meta-tags");
  const [json, setJson] = useToolInput("meta-tags", JSON.stringify(EMPTY));
  const m = useMemo(() => parse(json), [json]);
  const set = <K extends keyof MetaInput>(k: K, v: MetaInput[K]) => setJson(JSON.stringify({ ...m, [k]: v }));
  const html = useMemo(() => generateMetaTags(m), [m]);
  const host = hostname(m.url) || "example.com";
  const image = m.image.trim();

  return (
    <ToolShell
      toolId="meta-tags"
      inputLabel={t("page")}
      outputLabel={t("previews")}
      defaultInputSize={38}
      onExample={() => setJson(JSON.stringify(EXAMPLE))}
      onClear={() => setJson(JSON.stringify(EMPTY))}
      copyText={html}
      input={
        <div className="space-y-3 p-4">
          <Field
            label={t("fields.title")}
            value={m.title}
            onChange={(v) => set("title", v)}
            max={LIMITS.title}
            status={lengthStatus(m.title, LIMITS.title)}
          />
          <Field
            label={t("fields.description")}
            value={m.description}
            onChange={(v) => set("description", v)}
            max={LIMITS.description}
            status={lengthStatus(m.description, LIMITS.description, 70)}
            multiline
          />
          <Field label={t("fields.url")} value={m.url} onChange={(v) => set("url", v)} />
          <Field label={t("fields.image")} value={m.image} onChange={(v) => set("image", v)} />
          <p className="text-[11px] text-muted-foreground">{t("imageHint")}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("fields.siteName")} value={m.siteName} onChange={(v) => set("siteName", v)} />
            <Field label={t("fields.twitter")} value={m.twitterSite} onChange={(v) => set("twitterSite", v)} />
            <Field label={t("fields.locale")} value={m.locale} onChange={(v) => set("locale", v)} />
            <div className="space-y-1">
              <Label htmlFor="meta-type" className="text-xs">
                {t("fields.type")}
              </Label>
              <select
                id="meta-type"
                value={m.type}
                onChange={(e) => set("type", e.target.value as MetaInput["type"])}
                className="h-8 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="website">website</option>
                <option value="article">article</option>
                <option value="product">product</option>
              </select>
            </div>
          </div>
        </div>
      }
      output={
        <div className="space-y-6 p-4">
          <Preview title="Google">
            <div className="rounded-lg border bg-white p-4 font-sans text-[#202124]" data-testid="preview-google">
              <p className="truncate text-xs text-[#4d5156]">{breadcrumbUrl(m.url || `https://${host}`)}</p>
              <p className="mt-1 text-lg leading-6 text-[#1a0dab]">
                {truncate(m.title || t("placeholderTitle"), LIMITS.title)}
              </p>
              <p className="mt-1 text-sm leading-5 text-[#4d5156]">
                {truncate(m.description || t("placeholderDescription"), LIMITS.description)}
              </p>
            </div>
          </Preview>
          <Preview title="LinkedIn · Facebook">
            <div className="overflow-hidden rounded-lg border bg-white font-sans text-[#1d2226]">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" className="aspect-[1.91/1] w-full bg-neutral-200 object-cover" />
              ) : (
                <div className="grid aspect-[1.91/1] place-items-center bg-neutral-200 text-xs text-neutral-500">
                  1200 × 630
                </div>
              )}
              <div className="space-y-0.5 p-3">
                <p className="line-clamp-2 text-sm font-semibold">
                  {truncate(m.title || t("placeholderTitle"), LIMITS.ogTitle)}
                </p>
                <p className="text-xs text-[#666]">{host}</p>
              </div>
            </div>
          </Preview>
          <Preview title="X (Twitter)">
            <div className="overflow-hidden rounded-2xl border bg-white font-sans text-[#0f1419]">
              {image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" className="aspect-[1.91/1] w-full bg-neutral-200 object-cover" />
              )}
              <div className="space-y-0.5 p-3">
                <p className="text-xs text-[#536471]">{host}</p>
                <p className="truncate text-sm">{m.title || t("placeholderTitle")}</p>
                {!image && <p className="line-clamp-2 text-xs text-[#536471]">{m.description}</p>}
              </div>
            </div>
          </Preview>
          <Preview title="WhatsApp">
            <div className="max-w-sm rounded-lg bg-[#d9fdd3] p-1.5 font-sans text-[#111b21]">
              <div className="flex overflow-hidden rounded-md bg-[#c9eec2]">
                {image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" className="size-20 shrink-0 object-cover" />
                )}
                <div className="min-w-0 space-y-0.5 p-2">
                  <p className="truncate text-sm font-semibold">{m.title || t("placeholderTitle")}</p>
                  <p className="line-clamp-2 text-xs text-[#54656f]">{m.description}</p>
                  <p className="text-[11px] text-[#54656f]">{host}</p>
                </div>
              </div>
              <p className="px-1 pt-1 text-sm break-all text-[#027eb5]">{m.url}</p>
            </div>
          </Preview>
          <Preview title={t("code")}>
            <div className="h-72 overflow-hidden rounded-md border" data-testid="converter-output">
              <CodeEditor
                value={html}
                readOnly
                language="html"
                lineWrapping
                ariaLabel={t("code")}
                reportStatus={false}
              />
            </div>
          </Preview>
        </div>
      }
    />
  );
}
