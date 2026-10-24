"use client";

import { useMemo, useState } from "react";
import { Blocks, FlaskConical, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { CopyButton } from "@/components/shared/copy-button";
import { RegexExplanation } from "@/components/shared/regex-explanation";
import { RegexMatches } from "@/components/shared/regex-matches";
import { ToolShell } from "@/components/shared/tool-shell";
import { Segmented } from "@/components/shared/toolbar-controls";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppLocale } from "@/hooks/use-app-locale";
import { toolPath } from "@/lib/routes";
import { exportRegex, toLiteral, type ExportTarget } from "@/lib/utils/regex/export";
import { libraryPatterns } from "@/lib/utils/regex/library";
import { parseRegex } from "@/lib/utils/regex/parse";
import { runRegexTest } from "@/lib/utils/regex/tester";
import { matchesQuery } from "@/lib/utils/search/match";
import { encodeShareState } from "@/lib/utils/share/hash";
import { cn } from "cn";

export default function RegexLibrary() {
  const t = useTranslations("tools.regex-library");
  const locale = useAppLocale();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(libraryPatterns[0].id);
  const [target, setTarget] = useState<ExportTarget>("js");

  const visible = useMemo(
    () =>
      libraryPatterns.filter((p) =>
        matchesQuery(query, [p.id, t(`patterns.${p.id}.name`), t(`patterns.${p.id}.description`), p.source]),
      ),
    [query, t],
  );
  const selected = libraryPatterns.find((p) => p.id === selectedId) ?? libraryPatterns[0];
  const nodes = useMemo(() => {
    const r = parseRegex(selected.source, selected.flags);
    return r.ok ? r.nodes : [];
  }, [selected]);
  // Library patterns are known to be safe, so they run on the main thread.
  const examples = useMemo(() => {
    const r = runRegexTest({
      source: selected.source,
      flags: selected.flags,
      text: [...selected.valid, ...selected.invalid].join("\n"),
      mode: "lines",
    });
    return r.ok ? r.lines : [];
  }, [selected]);

  const testerHref = `${toolPath("regex-tester", locale)}#${encodeShareState({
    source: selected.source,
    flags: selected.flags,
    text: [...selected.valid, ...selected.invalid].join("\n"),
  })}`;
  const builderHref = `${toolPath("regex-builder", locale)}#${encodeShareState({ source: selected.source, flags: selected.flags })}`;

  return (
    <ToolShell
      toolId="regex-library"
      inputLabel={t("patterns_title")}
      outputLabel={t(`patterns.${selected.id}.name`)}
      defaultInputSize={35}
      onExample={() => setSelectedId("email")}
      onClear={() => setQuery("")}
      copyText={toLiteral(selected.source, selected.flags)}
      input={
        <div className="flex h-full min-h-0 flex-col">
          <div className="relative shrink-0 border-b p-2">
            <Search
              className="pointer-events-none absolute inset-y-0 start-4 my-auto size-3.5 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search")}
              aria-label={t("search")}
              className="h-8 ps-7 text-xs"
            />
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto p-1" aria-label={t("patterns_title")}>
            {visible.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  aria-current={p.id === selected.id ? "true" : undefined}
                  className={cn(
                    "w-full rounded-md px-3 py-2 text-start hover:bg-surface-3",
                    p.id === selected.id && "bg-accent shadow-[inset_2px_0_0_var(--primary)]",
                  )}
                >
                  <span className="block text-sm font-medium">{t(`patterns.${p.id}.name`)}</span>
                  <code className="block truncate font-mono text-[11px] text-muted-foreground">{p.source}</code>
                </button>
              </li>
            ))}
            {visible.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">{t("noResults")}</li>}
          </ul>
        </div>
      }
      output={
        <div className="divide-y">
          <section className="space-y-2 p-3">
            <p className="text-sm text-muted-foreground">{t(`patterns.${selected.id}.description`)}</p>
            <div className="flex items-start gap-2">
              <code
                data-testid="library-pattern"
                className="flex-1 rounded-md bg-editor p-3 font-mono text-sm break-all text-accent-text"
              >
                {toLiteral(selected.source, selected.flags)}
              </code>
              <CopyButton text={toLiteral(selected.source, selected.flags)} size="icon-sm" />
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Full navigation: the target tool reads its state from the # on mount. */}
              <a href={testerHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <FlaskConical />
                {t("openTester")}
              </a>
              <a href={builderHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <Blocks />
                {t("openBuilder")}
              </a>
            </div>
          </section>
          <section className="space-y-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-muted-foreground">{t("export")}</h3>
              <Segmented
                label={t("export")}
                value={target}
                onChange={setTarget}
                options={(["js", "html", "zod", "angular", "python"] as const).map((x) => ({
                  value: x,
                  label: x === "js" ? "JS/TS" : x === "html" ? "HTML" : x[0].toUpperCase() + x.slice(1),
                }))}
              />
            </div>
            <div className="flex items-start gap-2">
              <pre className="flex-1 overflow-x-auto rounded-md bg-editor p-3 font-mono text-xs">
                {exportRegex(selected.source, selected.flags, target)}
              </pre>
              <CopyButton text={exportRegex(selected.source, selected.flags, target)} size="icon-sm" />
            </div>
          </section>
          <section>
            <h3 className="px-3 pt-3 text-xs font-semibold text-muted-foreground">{t("examples")}</h3>
            <RegexMatches lines={examples} label={t("examples")} showGroups={false} />
          </section>
          <section>
            <h3 className="px-3 pt-3 text-xs font-semibold text-muted-foreground">{t("explanation")}</h3>
            <RegexExplanation nodes={nodes} />
          </section>
        </div>
      }
    />
  );
}
