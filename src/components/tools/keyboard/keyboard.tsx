"use client";

import { useState, type KeyboardEvent } from "react";
import { Keyboard as KeyboardIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { CopyButton } from "@/components/shared/copy-button";
import { ToolShell } from "@/components/shared/tool-shell";
import { ToolbarSwitch } from "@/components/shared/toolbar-controls";
import { combo, isModifier, keyLabel, locationName, shortcutSnippet, type KeyInfo } from "@/lib/utils/text/keyboard";
import { cn } from "cn";

const HISTORY = 12;

const toInfo = (e: KeyboardEvent): KeyInfo => ({
  key: e.key,
  code: e.code,
  keyCode: e.keyCode,
  location: e.location,
  ctrlKey: e.ctrlKey,
  shiftKey: e.shiftKey,
  altKey: e.altKey,
  metaKey: e.metaKey,
  repeat: e.repeat,
});

const EXAMPLE: KeyInfo = {
  key: "K",
  code: "KeyK",
  keyCode: 75,
  location: 0,
  ctrlKey: true,
  shiftKey: true,
  altKey: false,
  metaKey: false,
  repeat: false,
};

function Field({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="flex items-center gap-1 font-mono text-lg break-all" data-testid={testId}>
        {value}
        <CopyButton text={value} size="icon-sm" />
      </p>
    </div>
  );
}

export default function KeyboardTool() {
  const t = useTranslations("tools.keyboard");
  const [last, setLast] = useState<KeyInfo | null>(null);
  const [history, setHistory] = useState<KeyInfo[]>([]);
  const [prevent, setPrevent] = useState(true);
  const [mac, setMac] = useState(false);

  const record = (info: KeyInfo) => {
    setLast(info);
    setHistory((h) => [info, ...h].slice(0, HISTORY));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Tab still moves the focus out unless the user asks to capture it.
    if (prevent && !(e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey)) e.preventDefault();
    e.stopPropagation();
    record(toInfo(e));
  };

  const modifiers = last
    ? (["ctrlKey", "shiftKey", "altKey", "metaKey"] as const).map((m) => ({ m, on: last[m] }))
    : [];

  return (
    <ToolShell
      toolId="keyboard"
      inputLabel={t("press")}
      outputLabel={t("details")}
      onExample={() => record(EXAMPLE)}
      onClear={() => {
        setLast(null);
        setHistory([]);
      }}
      copyText={last ? shortcutSnippet(last) : ""}
      toolbar={
        <>
          <ToolbarSwitch label={t("prevent")} checked={prevent} onChange={setPrevent} />
          <ToolbarSwitch label={t("mac")} checked={mac} onChange={setMac} />
        </>
      }
      input={
        <div className="flex h-full flex-col gap-4 p-4">
          <div
            role="textbox"
            tabIndex={0}
            aria-label={t("press")}
            onKeyDown={onKeyDown}
            className="group flex min-h-48 flex-1 cursor-text flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed text-center outline-none focus:border-primary focus:bg-primary/5"
            data-testid="key-capture"
          >
            {last ? (
              <>
                <kbd className="rounded-lg border-b-4 bg-muted px-6 py-3 font-mono text-5xl" data-testid="key-big">
                  {keyLabel(last.key)}
                </kbd>
                <p className="font-mono text-xl text-accent-text" data-testid="key-combo">
                  {combo(last, mac)}
                </p>
              </>
            ) : (
              <KeyboardIcon className="size-10 text-muted-foreground" aria-hidden />
            )}
            <p className="text-sm text-muted-foreground group-focus:hidden">{t("focusHint")}</p>
            <p className="hidden text-sm text-muted-foreground group-focus:block">{t("listening")}</p>
          </div>
          {history.length > 0 && (
            <section>
              <h3 className="mb-1 text-xs font-semibold text-muted-foreground">{t("history")}</h3>
              <ol className="flex flex-wrap gap-1.5">
                {history.map((h, i) => (
                  <li key={i}>
                    <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{combo(h, mac)}</kbd>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      }
      output={
        !last ? (
          <p className="p-4 text-sm text-muted-foreground">{t("hint")}</p>
        ) : (
          <div className="space-y-4 p-4" data-testid="key-details">
            <div className="grid grid-cols-2 gap-3">
              <Field label="event.key" value={JSON.stringify(last.key)} testId="key-key" />
              <Field label="event.code" value={JSON.stringify(last.code)} testId="key-code" />
              <Field label={t("keyCode")} value={String(last.keyCode)} testId="key-keycode" />
              <Field
                label="event.location"
                value={`${last.location} · ${t(`locations.${locationName(last.location)}`)}`}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {modifiers.map(({ m, on }) => (
                <span
                  key={m}
                  className={cn(
                    "rounded-md border px-2 py-1 font-mono text-xs",
                    on ? "border-primary bg-primary/10 text-accent-text" : "text-muted-foreground",
                  )}
                >
                  {m}: {String(on)}
                </span>
              ))}
              {last.repeat && <span className="rounded-md border px-2 py-1 font-mono text-xs">repeat: true</span>}
            </div>
            {isModifier(last.key) && <p className="text-sm text-muted-foreground">{t("modifierOnly")}</p>}
            <section className="space-y-1">
              <h3 className="text-xs font-semibold text-muted-foreground">{t("snippet")}</h3>
              <pre
                className="overflow-auto rounded-md bg-editor p-3 font-mono text-xs leading-5"
                data-testid="key-snippet"
              >
                {shortcutSnippet(last)}
              </pre>
            </section>
            <p className="text-xs text-muted-foreground">{t("keyCodeNote")}</p>
          </div>
        )
      }
    />
  );
}
