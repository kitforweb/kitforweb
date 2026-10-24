"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "cn";

function Primitive({ value }: { value: unknown }) {
  if (value === null) return <span className="text-[var(--syntax-number)]">null</span>;
  if (typeof value === "string")
    return <span className="break-all text-[var(--syntax-string)]">&quot;{value}&quot;</span>;
  return <span className="text-[var(--syntax-number)]">{String(value)}</span>;
}

function Node({ name, value, depth }: { name: string | null; value: unknown; depth: number }) {
  const isArray = Array.isArray(value);
  const isObject = value !== null && typeof value === "object";
  const [open, setOpen] = useState(depth < 2);

  const label =
    name === null ? null : (
      <>
        <span className="text-[var(--syntax-key)]">{name}</span>
        <span className="text-muted-foreground">: </span>
      </>
    );

  if (!isObject) {
    return (
      <div className="ps-5 leading-6">
        {label}
        <Primitive value={value} />
      </div>
    );
  }

  const entries: [string, unknown][] = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, unknown>);
  const summary = isArray ? `[${entries.length}]` : `{${entries.length}}`;

  return (
    <div className="leading-6">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-sm text-start hover:bg-muted"
      >
        <ChevronRight
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
          aria-hidden
        />
        {label}
        <span className="text-muted-foreground">{summary}</span>
      </button>
      {open && (
        <div className="ms-2 border-s ps-2">
          {entries.map(([k, v]) => (
            <Node key={k} name={k} value={v} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Collapsible tree view. Children render only when expanded, so big files stay fast. */
export function JsonTree({ value }: { value: unknown }) {
  return (
    <div className="p-3 font-mono text-[13px]">
      <Node name={null} value={value} depth={0} />
    </div>
  );
}
