"use client";

import { CircleCheck, CircleX } from "lucide-react";
import type { LineResult } from "@/lib/utils/regex/tester";
import { segments } from "@/lib/utils/regex/tester";
import { cn } from "cn";

/** Test cases with their matches highlighted and capture groups listed. */
export function RegexMatches({
  lines,
  showGroups = true,
  label,
}: {
  lines: LineResult[];
  showGroups?: boolean;
  label: string;
}) {
  return (
    <ul aria-label={label} data-testid="regex-matches" className="divide-y">
      {lines.map((l, i) => (
        <li key={i} data-matched={l.matched} className="px-3 py-1.5">
          <div className="flex items-start gap-2">
            {l.matched ? (
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-label="✓" />
            ) : (
              <CircleX className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="✗" />
            )}
            <span className="font-mono text-[13px] break-all whitespace-pre-wrap">
              {l.line === "" ? (
                <span className="text-muted-foreground">∅</span>
              ) : (
                segments(l.line, l.matches).map((s, j) => (
                  <span
                    key={j}
                    className={cn(
                      s.match &&
                        "rounded-sm bg-primary/25 text-foreground underline decoration-primary underline-offset-4",
                    )}
                  >
                    {s.text}
                  </span>
                ))
              )}
            </span>
          </div>
          {showGroups && l.matches.some((m) => m.groups.length > 0) && (
            <dl className="ms-6 mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-xs text-muted-foreground">
              {l.matches[0].groups.map((g, k) => {
                const name = Object.entries(l.matches[0].named ?? {}).find(([, v]) => v === g)?.[0];
                return (
                  <div key={k} className="flex gap-1">
                    <dt>{name ?? `$${k + 1}`}</dt>
                    <dd className="text-foreground">{g === undefined ? "—" : JSON.stringify(g)}</dd>
                  </div>
                );
              })}
            </dl>
          )}
        </li>
      ))}
    </ul>
  );
}
