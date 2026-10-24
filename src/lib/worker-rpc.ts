/**
 * Tiny promise-based RPC over a Web Worker, so expensive work (quicktype,
 * large diffs, image encoding…) never freezes the interface.
 */
interface Pending<Res> {
  resolve: (value: Res) => void;
  reject: (reason: Error) => void;
}

export class WorkerTimeoutError extends Error {
  constructor() {
    super("timeout");
    this.name = "WorkerTimeoutError";
  }
}

/**
 * With `timeoutMs`, a request that takes too long terminates the worker (the
 * only way to stop runaway code such as a catastrophic regex) and rejects with
 * WorkerTimeoutError; the next request starts a fresh worker.
 */
export function createWorkerClient<Req, Res>(
  factory: () => Worker,
  { timeoutMs }: { timeoutMs?: number } = {},
): (request: Req) => Promise<Res> {
  let worker: Worker | null = null;
  let nextId = 0;
  const pending = new Map<number, Pending<Res>>();

  const start = () => {
    const w = factory();
    w.onmessage = (e: MessageEvent<{ id: number; ok: boolean; value?: Res; error?: string }>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data.value as Res);
      else p.reject(new Error(e.data.error));
    };
    w.onerror = (e) => {
      pending.forEach((p) => p.reject(new Error(e.message || "Worker error")));
      pending.clear();
      worker = null;
    };
    return w;
  };

  return (request) =>
    new Promise<Res>((resolve, reject) => {
      worker ??= start();
      const id = nextId++;
      let timer: ReturnType<typeof setTimeout> | undefined;
      pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      worker.postMessage({ id, request });
      if (timeoutMs) {
        timer = setTimeout(() => {
          worker?.terminate();
          worker = null;
          pending.forEach((p) => p.reject(new WorkerTimeoutError()));
          pending.clear();
        }, timeoutMs);
      }
    });
}

/** Worker side: answers each request with `handler`. */
export function exposeWorker<Req, Res>(handler: (request: Req) => Res | Promise<Res>): void {
  const scope = globalThis as unknown as {
    onmessage: ((e: MessageEvent<{ id: number; request: Req }>) => void) | null;
    postMessage: (msg: unknown, transfer?: Transferable[]) => void;
  };
  scope.onmessage = async (e) => {
    const { id, request } = e.data;
    try {
      const value = await handler(request);
      scope.postMessage({ id, ok: true, value });
    } catch (error) {
      scope.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  };
}
