"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleAlert, Redo2, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { CopyButton } from "@/components/shared/copy-button";
import { RegexExplanation } from "@/components/shared/regex-explanation";
import { RegexMatches } from "@/components/shared/regex-matches";
import { ToolShell } from "@/components/shared/tool-shell";
import { Segmented, ToolbarSwitch } from "@/components/shared/toolbar-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRegexTest } from "@/hooks/use-regex-test";
import { useShareHash } from "@/hooks/use-share-hash";
import { initialToolInput, usePersistInput } from "@/hooks/use-tool-input";
import { compile, type RegexNode } from "@/lib/utils/regex/blocks";
import { exportRegex, toLiteral, type ExportTarget } from "@/lib/utils/regex/export";
import { parseRegex } from "@/lib/utils/regex/parse";
import { normalizeFlags } from "@/lib/utils/regex/tester";
import { BlockEditor } from "./block-editor";
import { BlocksCanvas } from "./canvas";
import { useBlocksHistory } from "./use-blocks-history";

const EXAMPLE = "^[\\w.+-]+@[\\w-]+\\.(?:com|es|org)$";
const EXAMPLE_TESTS = "ada@example.com\nhello@kitforweb.es\nnot-an-email\nada@example.net";

interface Shared {
  source: string;
  flags: string;
}

const isShared = (v: unknown): v is Shared =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as Shared).source === "string" &&
  typeof (v as Shared).flags === "string";

const FLAGS = ["g", "i", "m", "s", "u"] as const;
const TARGETS: ExportTarget[] = ["js", "ts", "html", "zod", "angular", "python"];

function toNodes(source: string): RegexNode[] {
  const r = parseRegex(source);
  return r.ok ? r.nodes : [];
}

export default function RegexBuilder() {
  const t = useTranslations("tools.regex-builder");
  const share = useShareHash("regex-builder", isShared);
  const shared = useMemo(() => share.readInitial(), [share]);
  // What is persisted is the regex source; blocks are rebuilt from it.
  const history = useBlocksHistory(() =>
    toNodes(initialToolInput("regex-builder", "", { initial: () => shared?.source ?? null })),
  );
  const { nodes, set, undo, redo, canUndo, canRedo } = history;
  const [flags, setFlags] = useState(shared?.flags ?? "");
  const [selected, setSelected] = useState<string | null>(null);
  const [target, setTarget] = useState<ExportTarget>("js");
  const [tests, setTests] = useState("");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const regex = useMemo(() => compile(nodes), [nodes]);
  const compileError = useMemo(() => {
    try {
      new RegExp(regex, flags);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }, [regex, flags]);
  const { result } = useRegexTest(compileError ? "" : regex, flags, tests, "lines");

  usePersistInput("regex-builder", regex);

  // Ctrl+Z / Ctrl+Shift+Z outside text fields.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, [contenteditable]")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const importRegex = (text: string) => {
    const r = parseRegex(text, flags);
    if (!r.ok) {
      setImportError(r.error);
      return;
    }
    setImportError(null);
    set(r.nodes);
    setFlags(normalizeFlags(r.flags));
    setSelected(null);
  };

  const toggleFlag = (f: string) => (on: boolean) =>
    setFlags((cur) => normalizeFlags(on ? cur + f : cur.replace(f, "")));

  return (
    <ToolShell
      toolId="regex-builder"
      inputLabel={t("blocks")}
      outputLabel={t("result")}
      defaultInputSize={55}
      onExample={() => {
        importRegex(EXAMPLE);
        setTests(EXAMPLE_TESTS);
      }}
      onClear={() => {
        set([]);
        setSelected(null);
      }}
      copyText={toLiteral(regex, flags)}
      onShare={() => share.createLink({ source: regex, flags })}
      toolbar={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={undo} disabled={!canUndo} aria-label={t("undo")}>
            <Undo2 />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={redo} disabled={!canRedo} aria-label={t("redo")}>
            <Redo2 />
          </Button>
        </>
      }
      input={
        <div className="grid min-h-full gap-0 lg:grid-cols-[1fr_15rem]">
          <BlocksCanvas
            nodes={nodes}
            onChange={(n) => set(n)}
            selected={selected}
            onSelect={setSelected}
            extra={
              <form
                className="flex gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  importRegex(importText);
                }}
              >
                <Input
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={t("importPlaceholder")}
                  aria-label={t("import")}
                  className="h-8 font-mono text-xs"
                  spellCheck={false}
                />
                <Button type="submit" size="sm" variant="outline">
                  {t("import")}
                </Button>
              </form>
            }
          />
          <aside className="border-t p-3 lg:border-s lg:border-t-0" aria-label={t("settings")}>
            {importError && (
              <p role="alert" className="mb-2 text-xs text-destructive">
                {importError}
              </p>
            )}
            <BlockEditor nodes={nodes} selected={selected} onChange={(n, record) => set(n, record)} />
          </aside>
        </div>
      }
      output={
        <div className="divide-y">
          <section className="space-y-2 p-3">
            <div className="flex items-start gap-2">
              <code
                data-testid="regex-output"
                className="flex-1 rounded-md bg-editor p-3 font-mono text-sm break-all text-accent-text"
              >
                {toLiteral(regex, flags)}
              </code>
              <CopyButton text={toLiteral(regex, flags)} size="icon-sm" />
            </div>
            <div className="flex flex-wrap gap-1">
              {FLAGS.map((f) => (
                <ToolbarSwitch key={f} label={f} checked={flags.includes(f)} onChange={toggleFlag(f)} />
              ))}
            </div>
            {compileError && (
              <p role="alert" className="flex items-center gap-2 text-xs text-destructive">
                <CircleAlert className="size-3.5" aria-hidden />
                {compileError}
              </p>
            )}
          </section>
          <section className="space-y-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-muted-foreground">{t("export")}</h3>
              <Segmented
                label={t("export")}
                value={target}
                onChange={setTarget}
                options={TARGETS.map((x) => ({ value: x, label: t(`targets.${x}`) }))}
              />
            </div>
            <div className="flex items-start gap-2">
              <pre
                data-testid="regex-export"
                className="flex-1 overflow-x-auto rounded-md bg-editor p-3 font-mono text-xs"
              >
                {exportRegex(regex, flags, target)}
              </pre>
              <CopyButton text={exportRegex(regex, flags, target)} size="icon-sm" />
            </div>
          </section>
          <section className="space-y-2 p-3">
            <h3 className="text-xs font-semibold text-muted-foreground">{t("quickTest")}</h3>
            <Textarea
              value={tests}
              onChange={(e) => setTests(e.target.value)}
              placeholder={t("testsPlaceholder")}
              aria-label={t("quickTest")}
              className="min-h-20 font-mono text-xs"
              spellCheck={false}
            />
            {result?.ok && tests && <RegexMatches lines={result.lines} label={t("quickTest")} showGroups={false} />}
            {result && !result.ok && result.error === "timeout" && (
              <p className="text-xs text-destructive">{t("timeout")}</p>
            )}
          </section>
          <section>
            <RegexExplanation nodes={nodes} />
          </section>
        </div>
      }
    />
  );
}
