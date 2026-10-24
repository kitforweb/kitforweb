import type { AbstractIntlMessages } from "next-intl";
import { toolIds, type ToolId } from "@/config/tools";
import { defaultLocale, type Locale } from "./routing";
import { toolMessageFiles } from "./tools";

type Messages = { [key: string]: string | Messages };

function isObject(v: unknown): v is Messages {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** `over` wins; nested objects are merged key by key. */
export function deepMerge(base: Messages, over: Messages | undefined): Messages {
  if (!over) return base;
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = base[k];
    out[k] = isObject(b) && isObject(v) ? deepMerge(b, v) : v;
  }
  return out;
}

/**
 * Messages of one tool. Languages that are not fully translated yet (fr, pt)
 * fall back to English key by key.
 */
export function toolMessages(id: ToolId, locale: Locale): Messages {
  const file = toolMessageFiles[id] as Partial<Record<Locale, Messages>>;
  const en = file[defaultLocale] ?? {};
  return locale === defaultLocale ? en : deepMerge(en, file[locale]);
}

export function withToolMessages(base: Messages, locale: Locale): Messages {
  return { ...base, tools: Object.fromEntries(toolIds.map((id) => [id, toolMessages(id, locale)])) };
}

// Namespaces the client-side shell needs on every page.
const SHELL_NAMESPACES = ["nav", "explorer", "common", "status", "palette", "settings", "kinds", "detector", "donate"];

/**
 * Subset sent to the browser: the shell, every tool's name and summary (menu,
 * search, Ctrl+K) and, on a tool page, all the strings of that tool only plus
 * any shared namespace it declares in the registry.
 */
export function clientMessages(all: AbstractIntlMessages, toolId?: ToolId, extra: string[] = []): AbstractIntlMessages {
  const tools = (all.tools ?? {}) as Record<string, Messages>;
  const out: AbstractIntlMessages = {};
  for (const ns of [...SHELL_NAMESPACES, ...extra]) if (all[ns]) out[ns] = all[ns];
  out.tools = Object.fromEntries(
    Object.entries(tools).map(([id, m]) => [id, id === toolId ? m : { name: m.name, short: m.short }]),
  );
  return out;
}
