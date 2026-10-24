"use client";

import { useId, useMemo, useState } from "react";
import { CircleAlert, Download, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { ColorField } from "@/components/shared/color-field";
import { ImageDrop } from "@/components/shared/image-drop";
import { ToolShell } from "@/components/shared/tool-shell";
import { Segmented, ToolbarSelect, ToolbarSwitch } from "@/components/shared/toolbar-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToolInput } from "@/hooks/use-tool-input";
import { downloadBlob } from "@/lib/download";
import { brandExamples, exampleFile } from "@/lib/examples";
import { svgToPng } from "@/lib/svg-export";
import { convertColor } from "@/lib/utils/css/color";
import {
  qrMatrix,
  qrSvg,
  vcardPayload,
  wifiPayload,
  type ContactInput,
  type ErrorLevel,
  type WifiInput,
} from "@/lib/utils/image/qr";

type Mode = "text" | "wifi" | "contact";

const EMPTY_CONTACT: ContactInput = { firstName: "", lastName: "", phone: "", email: "", org: "", url: "" };

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
    </div>
  );
}

// Colors go into the SVG as attributes: only accept what parses as a color, as hex.
const safeColor = (c: string, fallback: string) => {
  const r = convertColor(c);
  return r.ok ? r.formats.hex : fallback;
};

export default function Qr() {
  const t = useTranslations("tools.qr");
  const textId = useId();
  // Only plain text is remembered; WiFi passwords and contacts are not persisted.
  const [text, setText] = useToolInput("qr", "");
  // Payloads handed off by the detector (WIFI:…, vCards) are plain text too.
  const [mode, setMode] = useState<Mode>("text");
  const [wifi, setWifi] = useState<WifiInput>({ ssid: "", password: "", encryption: "WPA", hidden: false });
  const [contact, setContact] = useState<ContactInput>(EMPTY_CONTACT);
  const [fg, setFg] = useState("#0f172a");
  const [bg, setBg] = useState("#ffffff");
  const [level, setLevel] = useState<ErrorLevel>("M");
  const [margin, setMargin] = useState(true);
  const [logo, setLogo] = useState<string | null>(null);

  const payload =
    mode === "text"
      ? text
      : mode === "wifi"
        ? wifi.ssid
          ? wifiPayload(wifi)
          : ""
        : contact.firstName || contact.lastName
          ? vcardPayload(contact)
          : "";
  // A logo hides modules: the highest error correction keeps the code readable.
  const effectiveLevel: ErrorLevel = logo ? "H" : level;
  const result = useMemo(() => (payload ? qrMatrix(payload, effectiveLevel) : null), [payload, effectiveLevel]);
  const svg = result?.ok
    ? qrSvg(result.qr, {
        fg: safeColor(fg, "#000000"),
        bg: safeColor(bg, "#ffffff"),
        margin: margin ? 4 : 0,
        logo: logo ? { href: logo, ratio: 0.22 } : undefined,
      })
    : "";
  const src = svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : "";

  const readLogo = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" && setLogo(reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <ToolShell
      toolId="qr"
      inputLabel={t("content")}
      outputLabel="QR"
      defaultInputSize={45}
      onExample={async () => {
        setMode("text");
        setText("https://kitforweb.com/en/qr-code-generator");
        readLogo(await exampleFile(brandExamples.icon));
      }}
      onClear={() => {
        setText("");
        setWifi({ ssid: "", password: "", encryption: "WPA", hidden: false });
        setContact(EMPTY_CONTACT);
        setLogo(null);
      }}
      copyText={payload}
      toolbar={
        <>
          <Segmented
            label={t("type")}
            value={mode}
            onChange={setMode}
            options={[
              { value: "text", label: t("modes.text") },
              { value: "wifi", label: "WiFi" },
              { value: "contact", label: t("modes.contact") },
            ]}
          />
          <ToolbarSelect
            label={t("correction")}
            value={effectiveLevel}
            onChange={setLevel}
            options={(["L", "M", "Q", "H"] as const).map((l) => ({ value: l, label: t(`levels.${l}`) }))}
          />
        </>
      }
      input={
        <div className="space-y-4 p-4">
          {mode === "text" && (
            <div className="space-y-1">
              <Label htmlFor={textId} className="text-xs text-muted-foreground">
                {t("textLabel")}
              </Label>
              <Textarea
                id={textId}
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                placeholder="https://…"
              />
            </div>
          )}
          {mode === "wifi" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("ssid")} value={wifi.ssid} onChange={(ssid) => setWifi((w) => ({ ...w, ssid }))} />
              <Field
                label={t("password")}
                type="password"
                value={wifi.password}
                onChange={(password) => setWifi((w) => ({ ...w, password }))}
              />
              <Segmented
                label={t("security")}
                value={wifi.encryption}
                onChange={(encryption: WifiInput["encryption"]) => setWifi((w) => ({ ...w, encryption }))}
                options={[
                  { value: "WPA", label: "WPA/WPA2/WPA3" },
                  { value: "WEP", label: "WEP" },
                  { value: "nopass", label: t("open") },
                ]}
              />
              <ToolbarSwitch
                label={t("hidden")}
                checked={wifi.hidden}
                onChange={(hidden) => setWifi((w) => ({ ...w, hidden }))}
              />
            </div>
          )}
          {mode === "contact" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {(["firstName", "lastName", "phone", "email", "org", "url"] as const).map((k) => (
                <Field
                  key={k}
                  label={t(`contact.${k}`)}
                  type={k === "email" ? "email" : k === "phone" ? "tel" : "text"}
                  value={contact[k]}
                  onChange={(v) => setContact((c) => ({ ...c, [k]: v }))}
                />
              ))}
            </div>
          )}
          <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
            <ColorField label={t("foreground")} value={fg} onChange={setFg} />
            <ColorField label={t("background")} value={bg} onChange={setBg} />
          </div>
          <ToolbarSwitch label={t("margin")} checked={margin} onChange={setMargin} />
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t("logo")}</p>
            {logo ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo} alt="" className="size-12 rounded border object-contain" />
                <Button type="button" variant="ghost" size="sm" onClick={() => setLogo(null)}>
                  <X />
                  {t("removeLogo")}
                </Button>
              </div>
            ) : (
              <ImageDrop onFile={([f]) => readLogo(f)} label={t("chooseLogo")} className="p-3" />
            )}
          </div>
        </div>
      }
      output={
        !result ? (
          <p className="p-4 text-sm text-muted-foreground">{t("hint")}</p>
        ) : !result.ok ? (
          <p role="alert" className="flex items-center gap-2 p-4 text-sm text-destructive">
            <CircleAlert className="size-4" aria-hidden />
            {t(`errors.${result.error}`)}
          </p>
        ) : (
          <div className="space-y-4 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={t("alt")}
              className="mx-auto w-full max-w-72 rounded-md border"
              data-testid="qr-image"
            />
            <p className="text-center font-mono text-xs text-muted-foreground" data-testid="qr-info">
              {t("info", { version: result.qr.version, size: result.qr.size, level: effectiveLevel })}
            </p>
            <div className="flex justify-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => downloadBlob(svg, "qr.svg", "image/svg+xml")}
              >
                <Download />
                SVG
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={async () =>
                  downloadBlob(await svgToPng(svg, 1024 / (result.qr.size + (margin ? 8 : 0))), "qr.png")
                }
              >
                <Download />
                PNG
              </Button>
            </div>
            <pre
              className="max-h-40 overflow-auto rounded-md bg-editor p-3 font-mono text-xs break-all whitespace-pre-wrap"
              data-testid="qr-payload"
            >
              {mode === "wifi" ? payload.replace(/P:(?:\\.|[^;])*/, "P:••••") : payload}
            </pre>
          </div>
        )
      }
    />
  );
}
