"use client";

import { useMemo, useState } from "react";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { CodeEditor } from "@/components/shared/code-editor";
import { RegexExplanation } from "@/components/shared/regex-explanation";
import { RegexMatches } from "@/components/shared/regex-matches";
import { ToolShell } from "@/components/shared/tool-shell";
import { Segmented } from "@/components/shared/toolbar-controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRegexTest } from "@/hooks/use-regex-test";
import { useShareHash } from "@/hooks/use-share-hash";
import { useToolInput } from "@/hooks/use-tool-input";
import { toLiteral } from "@/lib/utils/regex/export";
import { parseRegex } from "@/lib/utils/regex/parse";
import { normalizeFlags } from "@/lib/utils/regex/tester";

interface Shared {
  source: string;
  flags: string;
  text: string;
}

const isShared = (v: unknown): v is Shared =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as Shared).source === "string" &&
  typeof (v as Shared).flags === "string" &&
  typeof (v as Shared).text === "string";

const EXAMPLE: Shared = {
  source: "^(?<year>\\d{4})-(?<month>0[1-9]|1[0-2])-(?<day>0[1-9]|[12]\\d|3[01])$",
  flags: "",
  text: "2024-05-17\n1999-12-31\n2024-13-01\n24-05-17\n2024-02-30",
};

/** "/abc/gi" pasted in the pattern field is split into source and flags. */
function splitLiteral(value: string): { source: string; flags: string } | null {
  const m = /^\/(.+)\/([dgimsuvy]*)$/.exec(value.trim());
  return m ? { source: m[1], flags: m[2] } : null;
}

export default function RegexTester() {
  const t = useTranslations("tools.regex-tester");
  const tc = useTranslations("common");
  const share = useShareHash("regex-tester", isShared);
  const shared = useMemo(() => share.readInitial(), [share]);
  const [pattern, setPattern] = useToolInput("regex-tester", "", { initial: () => shared?.source ?? null });
  const [flags, setFlags] = useState(() => shared?.flags ?? splitLiteral(pattern)?.flags ?? "");
  const [text, setText] = useToolInput("regex-tester", "", { field: "tests", initial: () => shared?.text ?? null });
  const [mode, setMode] = useState<"lines" | "text">("lines");

  // A literal (from the detector or pasted) is split into pattern + flags.
  const literal = splitLiteral(pattern);
  const source = literal ? literal.source : pattern;
  const effectiveFlags = literal ? normalizeFlags(literal.flags + flags) : flags;

  const { result, pending } = useRegexTest(source, effectiveFlags, text, mode);
  const parsed = useMemo(() => (source ? parseRegex(source, effectiveFlags) : null), [source, effectiveFlags]);
  const passed = result?.ok ? result.lines.filter((l) => l.matched).length : 0;

  return (
    <ToolShell
      toolId="regex-tester"
      inputLabel={t("pattern")}
      outputLabel={t("results")}
      onExample={() => {
        setPattern(EXAMPLE.source);
        setFlags(EXAMPLE.flags);
        setText(EXAMPLE.text);
      }}
      onClear={() => {
        setPattern("");
        setText("");
      }}
      copyText={toLiteral(source, effectiveFlags)}
      onShare={() => share.createLink({ source, flags: effectiveFlags, text })}
      toolbar={
        <Segmented
          label={t("mode")}
          value={mode}
          onChange={setMode}
          options={[
            { value: "lines", label: t("eachLine") },
            { value: "text", label: t("wholeText") },
          ]}
        />
      }
      input={
        <div className="flex h-full min-h-0 flex-col">
          <div className="grid shrink-0 grid-cols-[1fr_6rem] gap-2 border-b bg-surface-1 p-3">
            <div className="space-y-1">
              <Label htmlFor="regex-pattern" className="text-xs">
                {t("pattern")}
              </Label>
              <div className="flex items-center rounded-md border bg-background font-mono text-sm focus-within:border-primary">
                <span className="ps-2 text-muted-foreground">/</span>
                <Input
                  id="regex-pattern"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder="^\d+$"
                  className="border-0 bg-transparent font-mono shadow-none focus-visible:ring-0 dark:bg-transparent"
                  spellCheck={false}
                  autoComplete="off"
                />
                <span className="pe-2 text-muted-foreground">/</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="regex-flags" className="text-xs">
                {t("flags")}
              </Label>
              <Input
                id="regex-flags"
                value={flags}
                onChange={(e) => setFlags(normalizeFlags(e.target.value))}
                placeholder="gim"
                className="font-mono"
                spellCheck={false}
              />
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <CodeEditor value={text} onChange={setText} ariaLabel={t("tests")} placeholder={t("testsPlaceholder")} />
          </div>
        </div>
      }
      output={
        !source ? (
          <p className="p-4 text-sm text-muted-foreground">{tc("emptyHint")}</p>
        ) : result && !result.ok ? (
          <p role="alert" className="flex items-start gap-2 p-4 text-sm text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {result.error === "timeout" ? t("timeout") : result.error}
          </p>
        ) : (
          <div className="divide-y">
            <p role="status" className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              {pending && <LoaderCircle className="size-3.5 animate-spin" aria-hidden />}
              {result?.ok && t("summary", { passed, total: result.lines.length })}
            </p>
            {result?.ok && <RegexMatches lines={result.lines} label={t("results")} />}
            {parsed?.ok && (
              <section>
                <h3 className="px-3 pt-3 text-xs font-semibold text-muted-foreground">{t("explanation")}</h3>
                <RegexExplanation nodes={parsed.nodes} />
              </section>
            )}
          </div>
        )
      }
    />
  );
}
