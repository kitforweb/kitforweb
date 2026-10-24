import type { ConvertResult } from "@/lib/utils/convert/result";
import type { QuicktypeRequest } from "@/lib/utils/json/quicktype";
import type { TestRequest, TestResult } from "@/lib/utils/regex/tester";
import type { SvgOptimizeRequest, SvgOptimizeResult } from "@/lib/utils/image/svg-optimize";
import type { DiffRequest, DiffResult } from "@/lib/utils/text/diff";
import { createWorkerClient } from "./worker-rpc";

// Each worker is created lazily, the first time it is called.

export const runQuicktype = createWorkerClient<QuicktypeRequest, ConvertResult>(
  () => new Worker(new URL("../workers/quicktype.worker.ts", import.meta.url), { type: "module" }),
);

/** Regex tests run in a worker that is killed after 1.5 s (catastrophic backtracking). */
export const runRegexInWorker = createWorkerClient<TestRequest, TestResult>(
  () => new Worker(new URL("../workers/regex.worker.ts", import.meta.url), { type: "module" }),
  { timeoutMs: 1500 },
);

/** Large diffs are O(n·d): they run off the main thread so typing stays smooth. */
export const runDiffInWorker = createWorkerClient<DiffRequest, DiffResult>(
  () => new Worker(new URL("../workers/diff.worker.ts", import.meta.url), { type: "module" }),
  { timeoutMs: 10_000 },
);

/** SVGO (≈200 kB) is loaded and runs only inside this worker. */
export const runSvgo = createWorkerClient<SvgOptimizeRequest, SvgOptimizeResult>(
  () => new Worker(new URL("../workers/svgo.worker.ts", import.meta.url), { type: "module" }),
  { timeoutMs: 15_000 },
);
