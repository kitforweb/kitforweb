"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Ban, Library as LibraryIcon, Play, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { CodeEditor } from "@/components/shared/code-editor";
import { ToolShell } from "@/components/shared/tool-shell";
import { ToolbarSwitch } from "@/components/shared/toolbar-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDebounced } from "@/hooks/use-debounced";
import { useShareHash } from "@/hooks/use-share-hash";
import { initialToolInput, usePersistInput } from "@/hooks/use-tool-input";
import { formatValue, type Serialized } from "@/lib/utils/playground/console-bridge";
import {
  buildDocument,
  esmUrl,
  parseLibraryUrl,
  QUICK_IMPORTS,
  QUICK_LIBRARIES,
  usesImports,
  type Library,
  type PlaygroundSource,
} from "@/lib/utils/playground/document";
import { cn } from "cn";

const EMPTY: PlaygroundSource = { html: "", css: "", js: "", libraries: [], imports: [], module: false };

const EXAMPLE: PlaygroundSource = {
  html: `<main>
  <h1>Hello, playground</h1>
  <p>Edit HTML, CSS and JS: the preview updates as you type.</p>
  <button id="counter">Clicked 0 times</button>
</main>`,
  css: `body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 90vh; margin: 0; }
main { text-align: center; }
h1 { color: #4f46e5; }
button { font: inherit; padding: .6rem 1.2rem; border-radius: .5rem; border: 0; background: #4f46e5; color: white; cursor: pointer; }`,
  js: `const button = document.querySelector("#counter");
let clicks = 0;
button.addEventListener("click", () => {
  clicks++;
  button.textContent = \`Clicked \${clicks} times\`;
  console.log("Clicked", clicks);
});
console.log("Ready", { items: 3 });`,
  libraries: [],
  imports: [],
  module: false,
};

const isLibrary = (v: unknown): v is Library => {
  const l = v as Library;
  return typeof l === "object" && l !== null && typeof l.url === "string" && parseLibraryUrl(l.url).ok;
};

function isSource(v: unknown): v is PlaygroundSource {
  const s = v as PlaygroundSource;
  return (
    typeof s === "object" &&
    s !== null &&
    typeof s.html === "string" &&
    typeof s.css === "string" &&
    typeof s.js === "string" &&
    typeof s.module === "boolean" &&
    Array.isArray(s.libraries) &&
    s.libraries.every(isLibrary) &&
    Array.isArray(s.imports) &&
    s.imports.every((i) => typeof i === "string")
  );
}

function initial(shared: PlaygroundSource | null): PlaygroundSource {
  const text = initialToolInput("playground", "", { initial: () => (shared ? JSON.stringify(shared) : null) });
  if (!text) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(text);
    if (isSource(parsed)) return parsed;
  } catch {
    // Not JSON: HTML handed off from elsewhere becomes the HTML of a new pen.
  }
  return { ...EMPTY, html: text };
}

/** Short stable hash, so each different document gets its own run id. */
function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i);
  return (h >>> 0).toString(36);
}

interface LogEntry {
  run: string;
  level: string;
  args: Serialized[];
}

const LEVEL_STYLE: Record<string, string> = {
  error: "bg-destructive/10 text-destructive",
  warn: "bg-warning/10 text-warning",
  info: "text-accent-text",
  debug: "text-muted-foreground",
};

export default function Playground() {
  const t = useTranslations("tools.playground");
  const share = useShareHash("playground", isSource);
  const [src, setSrc] = useState<PlaygroundSource>(() => initial(share.readInitial()));
  const [autoRun, setAutoRun] = useState(true);
  const [manual, setManual] = useState<{ src: PlaygroundSource; n: number }>(() => ({ src, n: 0 }));
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [libUrl, setLibUrl] = useState("");
  const [importText, setImportText] = useState("");
  const frame = useRef<HTMLIFrameElement>(null);
  const debounced = useDebounced(src, 500);
  usePersistInput("playground", JSON.stringify(src));

  const running = autoRun ? debounced : manual.src;
  const effective = useMemo(() => ({ ...running, module: running.module || usesImports(running.js) }), [running]);
  const run = `${manual.n}-${hash(JSON.stringify(effective))}`;
  const doc = useMemo(() => buildDocument(effective, run, window.location.origin), [effective, run]);
  const visibleLogs = logs.filter((l) => l.run === run);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // Only the current preview may write to the console.
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      const data = e.data as { source?: string; run?: string; level?: string; args?: Serialized[] };
      if (data?.source !== "kfw-playground" || data.run !== run || !Array.isArray(data.args)) return;
      const level = data.level ?? "log";
      if (level === "clear") setLogs((ls) => ls.filter((l) => l.run !== run));
      else setLogs((ls) => [...ls.slice(-499), { run, level, args: data.args! }]);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [run]);

  const set = <K extends keyof PlaygroundSource>(k: K, v: PlaygroundSource[K]) => setSrc((s) => ({ ...s, [k]: v }));
  const toggleLibrary = (lib: Library) =>
    set(
      "libraries",
      src.libraries.some((l) => l.id === lib.id)
        ? src.libraries.filter((l) => l.id !== lib.id)
        : [...src.libraries, lib],
    );
  const custom = libUrl.trim() ? parseLibraryUrl(libUrl) : null;
  const importOk = importText.trim() ? esmUrl(importText) !== null : false;
  const addImport = (spec: string) => !src.imports.includes(spec) && set("imports", [...src.imports, spec]);
  const extras = src.libraries.length + src.imports.length;

  const editor = (key: "html" | "css" | "js", language: "html" | "css" | "javascript") => (
    <TabsContent value={key} className="min-h-0 flex-1">
      <CodeEditor value={src[key]} onChange={(v) => set(key, v)} language={language} ariaLabel={key.toUpperCase()} />
    </TabsContent>
  );

  return (
    <ToolShell
      toolId="playground"
      inputLabel={t("code")}
      outputLabel={t("preview")}
      onExample={() => {
        setSrc(EXAMPLE);
        setManual((m) => ({ src: EXAMPLE, n: m.n + 1 }));
      }}
      onClear={() => {
        setSrc(EMPTY);
        setManual((m) => ({ src: EMPTY, n: m.n + 1 }));
      }}
      copyText={() => buildDocument(src, "export", "*")}
      onShare={() => share.createLink(src)}
      toolbar={
        <>
          <Button type="button" size="sm" onClick={() => setManual((m) => ({ src, n: m.n + 1 }))}>
            <Play />
            {t("run")}
          </Button>
          <ToolbarSwitch label={t("autoRun")} checked={autoRun} onChange={setAutoRun} />
          <ToolbarSwitch
            label={t("module")}
            checked={src.module || usesImports(src.js)}
            onChange={(v) => set("module", v)}
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="sm">
                <LibraryIcon />
                {t("libraries")}
                {extras > 0 && <span className="rounded bg-primary/15 px-1 font-mono text-[10px]">{extras}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 space-y-4" align="start">
              <section className="space-y-1.5">
                <h3 className="text-xs font-semibold text-muted-foreground">{t("quick")}</h3>
                <ul className="grid grid-cols-2 gap-1">
                  {QUICK_LIBRARIES.map((lib) => (
                    <li key={lib.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted">
                        <input
                          type="checkbox"
                          className="accent-[var(--primary)]"
                          checked={src.libraries.some((l) => l.id === lib.id)}
                          onChange={() => toggleLibrary(lib)}
                        />
                        {lib.name}
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="space-y-1.5">
                <h3 className="text-xs font-semibold text-muted-foreground">{t("customUrl")}</h3>
                <div className="flex gap-2">
                  <Input
                    value={libUrl}
                    onChange={(e) => setLibUrl(e.target.value)}
                    placeholder="https://cdn.jsdelivr.net/npm/…"
                    aria-label={t("customUrl")}
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="secondary"
                    aria-label={t("add")}
                    disabled={!custom?.ok}
                    onClick={() => {
                      if (custom?.ok && !src.libraries.some((l) => l.id === custom.library.id)) {
                        set("libraries", [...src.libraries, custom.library]);
                        setLibUrl("");
                      }
                    }}
                  >
                    <Plus />
                  </Button>
                </div>
                {custom && !custom.ok && <p className="text-xs text-destructive">{t(`errors.${custom.error}`)}</p>}
                <ul className="space-y-0.5">
                  {src.libraries
                    .filter((l) => !QUICK_LIBRARIES.some((q) => q.id === l.id))
                    .map((l) => (
                      <li key={l.id} className="flex items-center gap-2 font-mono text-xs">
                        <span className="flex-1 truncate" title={l.url}>
                          {l.name}
                        </span>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={t("remove")}
                          onClick={() => toggleLibrary(l)}
                        >
                          <X />
                        </Button>
                      </li>
                    ))}
                </ul>
              </section>
              <section className="space-y-1.5">
                <h3 className="text-xs font-semibold text-muted-foreground">{t("imports")}</h3>
                <div className="flex gap-2">
                  <Input
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="canvas-confetti@1"
                    aria-label={t("imports")}
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="secondary"
                    aria-label={t("add")}
                    disabled={!importOk}
                    onClick={() => {
                      addImport(importText.trim());
                      setImportText("");
                    }}
                  >
                    <Plus />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {QUICK_IMPORTS.filter((q) => !src.imports.includes(q)).map((q) => (
                    <Button key={q} type="button" variant="outline" size="xs" onClick={() => addImport(q)}>
                      {q}
                    </Button>
                  ))}
                </div>
                <ul className="space-y-0.5">
                  {src.imports.map((i) => (
                    <li key={i} className="flex items-center gap-2 font-mono text-xs">
                      <span className="flex-1 truncate">
                        {i} → esm.sh/{i}
                      </span>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={t("remove")}
                        onClick={() =>
                          set(
                            "imports",
                            src.imports.filter((x) => x !== i),
                          )
                        }
                      >
                        <X />
                      </Button>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted-foreground">{t("importsHint")}</p>
              </section>
            </PopoverContent>
          </Popover>
        </>
      }
      input={
        <Tabs defaultValue="html" className="flex h-full min-h-0 flex-col gap-0">
          <TabsList className="m-1 shrink-0">
            <TabsTrigger value="html">HTML</TabsTrigger>
            <TabsTrigger value="css">CSS</TabsTrigger>
            <TabsTrigger value="js">JS</TabsTrigger>
          </TabsList>
          {editor("html", "html")}
          {editor("css", "css")}
          {editor("js", "javascript")}
        </Tabs>
      }
      output={
        <div className="flex h-full min-h-0 flex-col">
          <iframe
            ref={frame}
            key={run}
            title={t("preview")}
            // No allow-same-origin: the code runs in an opaque origin, without access to this page or its storage.
            sandbox="allow-scripts"
            srcDoc={doc}
            className="min-h-0 w-full flex-1 bg-white"
            data-testid="playground-frame"
          />
          <section className="flex h-40 shrink-0 flex-col border-t" aria-label={t("console")}>
            <div className="flex h-8 shrink-0 items-center justify-between border-b bg-surface-1 px-3">
              <span className="font-mono text-xs text-muted-foreground">
                {t("console")} ({visibleLogs.length})
              </span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setLogs((ls) => ls.filter((l) => l.run !== run))}
                disabled={visibleLogs.length === 0}
              >
                <Ban />
                {t("clear")}
              </Button>
            </div>
            <ol className="min-h-0 flex-1 overflow-auto font-mono text-xs" data-testid="playground-console">
              {visibleLogs.map((l, i) => (
                <li
                  key={i}
                  className={cn("border-b px-3 py-1 break-all whitespace-pre-wrap", LEVEL_STYLE[l.level])}
                  data-level={l.level}
                >
                  {l.args.map((a) => formatValue(a)).join(" ")}
                </li>
              ))}
            </ol>
          </section>
        </div>
      }
    />
  );
}
