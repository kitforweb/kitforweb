"use client";

import { useMemo } from "react";
import type { TestResult } from "@/lib/utils/regex/tester";
import { WorkerTimeoutError } from "@/lib/worker-rpc";
import { runRegexInWorker } from "@/lib/workers";
import { useDebounced } from "./use-debounced";
import { useSettled } from "./use-settled";

export type RegexTestState = TestResult | { ok: false; error: "timeout" } | undefined;

/**
 * Runs a regex against test text in a Web Worker. A pattern that takes too
 * long (catastrophic backtracking) is stopped and reported as "timeout".
 */
export function useRegexTest(
  source: string,
  flags: string,
  text: string,
  mode: "lines" | "text",
): { result: RegexTestState; pending: boolean } {
  const s = useDebounced(source, 200);
  const f = useDebounced(flags, 200);
  const x = useDebounced(text, 200);
  const promise = useMemo<Promise<RegexTestState> | null>(() => {
    if (!s) return null;
    return runRegexInWorker({ source: s, flags: f, text: x, mode }).catch((e: unknown) =>
      e instanceof WorkerTimeoutError
        ? { ok: false as const, error: "timeout" }
        : { ok: false as const, error: String(e) },
    );
  }, [s, f, x, mode]);
  const { value, pending } = useSettled(promise);
  return { result: promise ? (value ?? undefined) : undefined, pending };
}
