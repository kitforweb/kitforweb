import { CronExpressionParser } from "cron-parser";
import cronstrue from "cronstrue";
import "cronstrue/locales/es";
import "cronstrue/locales/fr";
import "cronstrue/locales/pt_BR";

const CRONSTRUE_LOCALE: Record<string, string> = { en: "en", es: "es", fr: "fr", pt: "pt_BR" };

export const MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

export type CronResult = { ok: true; description: string; next: Date[]; fields: number } | { ok: false; error: string };

/** Expands macros and normalises spacing. */
export function normalizeCron(expr: string): string {
  const text = expr.trim().replace(/\s+/g, " ");
  return MACROS[text.toLowerCase()] ?? text;
}

/**
 * Explains a cron expression in the user's language and lists its next runs.
 * Supports 5 fields (minute…day of week) and 6 (with seconds first).
 */
export function analyzeCron(
  expr: string,
  locale: string,
  options: { count?: number; from?: Date; tz?: string } = {},
): CronResult {
  const text = normalizeCron(expr);
  if (!text) return { ok: false, error: "empty" };
  const fields = text.split(" ").length;
  if (fields < 5 || fields > 6) return { ok: false, error: `Expected 5 or 6 fields, got ${fields}` };
  let description: string;
  try {
    description = cronstrue.toString(text, {
      locale: CRONSTRUE_LOCALE[locale] ?? "en",
      use24HourTimeFormat: locale !== "en",
      throwExceptionOnParseError: true,
    });
  } catch (e) {
    return { ok: false, error: String(e).replace(/^Error:\s*/, "") };
  }
  try {
    const it = CronExpressionParser.parse(text, { currentDate: options.from ?? new Date(), tz: options.tz });
    const next = it.take(options.count ?? 10).map((d) => d.toDate());
    return { ok: true, description, next, fields };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface CronParts {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

export function buildCron(p: CronParts): string {
  return [p.minute, p.hour, p.dayOfMonth, p.month, p.dayOfWeek].map((f) => f.trim() || "*").join(" ");
}

export function splitCron(expr: string): CronParts | null {
  const parts = normalizeCron(expr).split(" ");
  if (parts.length !== 5) return null;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  return { minute, hour, dayOfMonth, month, dayOfWeek };
}

export const CRON_PRESETS = {
  everyMinute: "* * * * *",
  every5Minutes: "*/5 * * * *",
  hourly: "0 * * * *",
  daily9: "0 9 * * *",
  weekdays9: "0 9 * * 1-5",
  weeklyMonday: "0 9 * * 1",
  monthlyFirst: "0 0 1 * *",
  yearly: "0 0 1 1 *",
} as const;
