"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { RegexNode } from "@/lib/utils/regex/blocks";
import { describeQuantifier, explain } from "@/lib/utils/regex/explain";

/** Uses the shared "regex" message namespace (declared by regex tools in the registry). */
export function useDescribeNode() {
  const t = useTranslations("regex");
  return (node: RegexNode): string => {
    let text: string;
    switch (node.type) {
      case "literal":
        text = t("explain.literal", { value: node.value });
        break;
      case "charset":
        text = t(node.negate ? "explain.charsetNegated" : "explain.charset", { chars: node.chars });
        break;
      case "group":
        text = node.capture
          ? node.name
            ? t("explain.groupNamed", { name: node.name })
            : t("explain.groupCapture")
          : t("explain.groupPlain");
        break;
      case "alt":
        text = t("explain.alt", { count: node.branches.length });
        break;
      case "raw":
        text = t("explain.raw", { source: node.source });
        break;
      default:
        text = t(`explain.${node.type}`);
    }
    const q = describeQuantifier(node.quantifier);
    if (q) {
      text += ` — ${t(`quantifier.${q.kind}`, { min: q.min, max: q.max ?? 0 })}`;
      if (node.quantifier?.lazy) text += ` (${t("quantifier.lazy")})`;
    }
    return text;
  };
}

/** Part-by-part explanation of a regex, in the user's language. */
export function RegexExplanation({ nodes }: { nodes: RegexNode[] }) {
  const t = useTranslations("regex");
  const describe = useDescribeNode();
  const items = useMemo(() => explain(nodes), [nodes]);
  if (items.length === 0) return <p className="px-3 py-2 text-xs text-muted-foreground">{t("noExplanation")}</p>;
  return (
    <ol className="space-y-1 px-3 py-2 text-[13px]" aria-label={t("explanation")} data-testid="regex-explanation">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3" style={{ paddingInlineStart: `${item.depth * 1}rem` }}>
          {item.branch !== undefined ? (
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              {t("explain.branch", { n: item.branch + 1 })}
            </span>
          ) : (
            <>
              <code className="shrink-0 rounded bg-editor px-1.5 font-mono text-xs text-accent-text">
                {item.source}
              </code>
              <span>{describe(item.node)}</span>
            </>
          )}
        </li>
      ))}
    </ol>
  );
}
