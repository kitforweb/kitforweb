/**
 * Code that runs INSIDE the sandboxed preview. It is written as real functions
 * so it can be unit-tested, and injected with Function.prototype.toString(), so
 * every function here must be self-contained: no imports, no outer variables.
 */

/** A value from the preview, made safe to send through postMessage and to show. */
export type Serialized =
  | { t: "string"; v: string }
  | { t: "number" | "boolean" | "bigint" | "symbol" | "undefined" | "null" | "function"; v: string }
  | { t: "error"; name: string; message: string; stack?: string }
  | { t: "element"; v: string }
  | { t: "array"; items: Serialized[]; more: number }
  | { t: "object"; name: string; entries: [string, Serialized][]; more: number }
  | { t: "circular" }
  | { t: "truncated" };

export function serialize(value: unknown, depth = 0, seen: unknown[] = []): Serialized {
  const MAX_DEPTH = 4;
  const MAX_ITEMS = 50;
  if (value === null) return { t: "null", v: "null" };
  const type = typeof value;
  if (type === "string") return { t: "string", v: value as string };
  if (type === "number" || type === "boolean" || type === "undefined")
    return { t: type, v: String(value) } as Serialized;
  if (type === "bigint") return { t: "bigint", v: `${String(value)}n` };
  if (type === "symbol") return { t: "symbol", v: String(value) };
  if (type === "function") {
    const fn = value as { name?: string };
    return { t: "function", v: `ƒ ${fn.name || "anonymous"}()` };
  }
  if (value instanceof Error) return { t: "error", name: value.name, message: value.message, stack: value.stack };
  // DOM nodes: show the tag, not thousands of properties.
  if (typeof Element !== "undefined" && value instanceof Element) {
    const el = value as Element;
    const id = el.id ? `#${el.id}` : "";
    const cls =
      typeof el.className === "string" && el.className ? `.${el.className.trim().split(/\s+/).join(".")}` : "";
    return { t: "element", v: `<${el.tagName.toLowerCase()}${id}${cls}>` };
  }
  if (seen.indexOf(value) >= 0) return { t: "circular" };
  if (depth >= MAX_DEPTH) return { t: "truncated" };
  const next = seen.concat([value]);
  if (Array.isArray(value)) {
    return {
      t: "array",
      items: value.slice(0, MAX_ITEMS).map((v) => serialize(v, depth + 1, next)),
      more: Math.max(0, value.length - MAX_ITEMS),
    };
  }
  let source: [string, unknown][];
  let name = "Object";
  if (value instanceof Map) {
    name = "Map";
    source = Array.from(value.entries()).map(([k, v]) => [String(k), v]);
  } else if (value instanceof Set) {
    name = "Set";
    source = Array.from(value.values()).map((v, i) => [String(i), v]);
  } else if (value instanceof Date) {
    return { t: "string", v: isNaN(value.getTime()) ? "Invalid Date" : value.toISOString() };
  } else {
    const proto = Object.getPrototypeOf(value);
    name = proto && proto.constructor && proto.constructor.name ? proto.constructor.name : "Object";
    source = Object.keys(value as object).map((k) => [k, (value as Record<string, unknown>)[k]]);
  }
  return {
    t: "object",
    name,
    entries: source.slice(0, MAX_ITEMS).map(([k, v]) => [k, serialize(v, depth + 1, next)]),
    more: Math.max(0, source.length - MAX_ITEMS),
  };
}

/** Readable one-line text of a serialized value, as browser consoles show it. */
export function formatValue(s: Serialized, top = true): string {
  switch (s.t) {
    case "string":
      return top ? s.v : JSON.stringify(s.v);
    case "error":
      return `${s.name}: ${s.message}`;
    case "array":
      return `[${s.items.map((i) => formatValue(i, false)).join(", ")}${s.more ? `, …${s.more} more` : ""}]`;
    case "object": {
      const body = s.entries.map(
        ([k, v]) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${formatValue(v, false)}`,
      );
      const prefix = s.name === "Object" ? "" : `${s.name} `;
      return `${prefix}{${body.length ? ` ${body.join(", ")}${s.more ? `, …${s.more} more` : ""} ` : ""}}`;
    }
    case "circular":
      return "[Circular]";
    case "truncated":
      return "…";
    default:
      return s.v;
  }
}

/**
 * Patches console, alert and error events in the preview and forwards them to
 * the parent page. `origin` is the parent's origin; `run` identifies this run.
 */
export function installBridge(run: string, origin: string, serializeFn: typeof serialize): void {
  const send = (level: string, args: unknown[]) => {
    try {
      window.parent.postMessage(
        { source: "kfw-playground", run, level, args: args.map((a) => serializeFn(a)) },
        origin,
      );
    } catch {
      // A value that cannot be cloned is never fatal for the user's code.
    }
  };
  const levels = ["log", "info", "warn", "error", "debug", "table"] as const;
  const original = window.console;
  const patched = Object.create(original) as Record<string, unknown>;
  levels.forEach((level) => {
    const native = (original[level] as (...a: unknown[]) => void).bind(original);
    patched[level] = (...args: unknown[]) => {
      send(level === "table" ? "log" : level, args);
      native(...args);
    };
  });
  patched.clear = () => send("clear", []);
  Object.defineProperty(window, "console", { value: patched, configurable: true });
  // Without allow-modals, alert/confirm/prompt are blocked: show them in the console instead.
  window.alert = (m?: unknown) => send("info", ["alert:", m]);
  window.addEventListener("error", (e) => send("error", [e.error ?? e.message]));
  window.addEventListener("unhandledrejection", (e) => send("error", ["Uncaught (in promise)", e.reason]));
}
