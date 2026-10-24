"use client";

import { useEffect, useState } from "react";

/**
 * Resolves a value that may be a Promise (compute it with useMemo first).
 * Returns the latest settled value (`undefined` until the first one) and
 * whether a newer one is still pending.
 */
export function useSettled<T>(current: T | Promise<T>): { value: T | undefined; pending: boolean } {
  const [settled, setSettled] = useState<{ source: Promise<T>; value: T } | null>(null);

  useEffect(() => {
    if (!(current instanceof Promise)) return;
    let cancelled = false;
    void current.then((value) => {
      if (!cancelled) setSettled({ source: current, value });
    });
    return () => {
      cancelled = true;
    };
  }, [current]);

  if (!(current instanceof Promise)) return { value: current, pending: false };
  return { value: settled?.value, pending: settled?.source !== current };
}
