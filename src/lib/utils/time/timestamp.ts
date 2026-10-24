export type EpochUnit = "s" | "ms" | "us" | "ns";

export type ParsedTime =
  | { ok: true; date: Date; source: "epoch"; unit: EpochUnit }
  | { ok: true; date: Date; source: "text" }
  | { ok: false; error: "empty" | "invalid" | "range" };

/** Guesses the unit of an epoch number by its magnitude (seconds until year 5138). */
export function guessEpochUnit(value: number): EpochUnit {
  const abs = Math.abs(value);
  if (abs < 1e11) return "s";
  if (abs < 1e14) return "ms";
  if (abs < 1e17) return "us";
  return "ns";
}

const FACTOR: Record<EpochUnit, number> = { s: 1000, ms: 1, us: 0.001, ns: 0.000001 };

// JavaScript dates are limited to ±8.64e15 ms around 1970.
const MAX_MS = 8.64e15;

/**
 * Accepts Unix epochs (seconds, milliseconds, micro- or nanoseconds, decimals
 * allowed), ISO 8601 and RFC 2822 dates. `unit` forces the epoch unit.
 */
export function parseTimeInput(input: string, unit: EpochUnit | "auto" = "auto"): ParsedTime {
  const text = input.trim();
  if (!text) return { ok: false, error: "empty" };
  if (/^-?\d+(\.\d+)?$/.test(text)) {
    const value = Number(text);
    const u = unit === "auto" ? guessEpochUnit(value) : unit;
    const ms = value * FACTOR[u];
    if (!Number.isFinite(ms) || Math.abs(ms) > MAX_MS) return { ok: false, error: "range" };
    return { ok: true, date: new Date(ms), source: "epoch", unit: u };
  }
  const ms = Date.parse(text);
  if (Number.isNaN(ms)) return { ok: false, error: "invalid" };
  return { ok: true, date: new Date(ms), source: "text" };
}

export interface TimeFormats {
  seconds: string;
  milliseconds: string;
  iso: string;
  utc: string;
  local: string;
  /** "2 hours ago", "in 3 days"… */
  relative: string;
  dayOfWeek: string;
  /** ISO week number. */
  week: number;
  dayOfYear: number;
}

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

export function relativeTime(date: Date, now: Date, locale: string): string {
  let duration = (date.getTime() - now.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const d of DIVISIONS) {
    if (Math.abs(duration) < d.amount) return rtf.format(Math.round(duration), d.unit);
    duration /= d.amount;
  }
  return rtf.format(Math.round(duration), "year");
}

export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

export function dayOfYear(date: Date): number {
  return (
    Math.floor(
      (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(date.getUTCFullYear(), 0, 1)) /
        86_400_000,
    ) + 1
  );
}

/** Every representation of an instant. `timeZone` defaults to the user's. */
export function formatTime(date: Date, locale: string, now: Date = new Date(), timeZone?: string): TimeFormats {
  const ms = date.getTime();
  return {
    seconds: String(Math.floor(ms / 1000)),
    milliseconds: String(ms),
    iso: date.toISOString(),
    utc: date.toUTCString(),
    local: new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "long", timeZone }).format(date),
    relative: relativeTime(date, now, locale),
    dayOfWeek: new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(date),
    week: isoWeek(date),
    dayOfYear: dayOfYear(date),
  };
}
