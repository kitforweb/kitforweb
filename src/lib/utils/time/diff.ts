import { add, differenceInBusinessDays, intervalToDuration, sub, type Duration } from "date-fns";

export interface DateDifference {
  /** Calendar breakdown: 1 year, 2 months, 3 days… */
  parts: Required<Pick<Duration, "years" | "months" | "days" | "hours" | "minutes" | "seconds">>;
  totalDays: number;
  totalHours: number;
  totalMinutes: number;
  totalSeconds: number;
  totalWeeks: number;
  /** Monday to Friday between both dates (the end date excluded). */
  businessDays: number;
  /** True when `end` is before `start` (the parts are then absolute). */
  negative: boolean;
}

export function dateDifference(start: Date, end: Date): DateDifference {
  const negative = end.getTime() < start.getTime();
  const [a, b] = negative ? [end, start] : [start, end];
  const d = intervalToDuration({ start: a, end: b });
  const ms = b.getTime() - a.getTime();
  const sign = negative ? -1 : 1;
  return {
    parts: {
      years: d.years ?? 0,
      months: d.months ?? 0,
      days: d.days ?? 0,
      hours: d.hours ?? 0,
      minutes: d.minutes ?? 0,
      seconds: d.seconds ?? 0,
    },
    totalDays: sign * Math.floor(ms / 86_400_000),
    totalWeeks: sign * Math.floor(ms / 604_800_000),
    totalHours: sign * Math.floor(ms / 3_600_000),
    totalMinutes: sign * Math.floor(ms / 60_000),
    totalSeconds: sign * Math.floor(ms / 1000),
    businessDays: differenceInBusinessDays(end, start),
    negative,
  };
}

export type DurationInput = Partial<Record<"years" | "months" | "weeks" | "days" | "hours" | "minutes", number>>;

/** Adds (or subtracts) a duration in calendar terms: +1 month from Jan 31 is Feb 28/29. */
export function shiftDate(date: Date, duration: DurationInput, subtract = false): Date {
  const clean = Object.fromEntries(Object.entries(duration).filter(([, v]) => Number.isFinite(v) && v !== 0));
  return subtract ? sub(date, clean) : add(date, clean);
}

/** "2026-05-01T10:30" (datetime-local value) in local time; null if invalid. */
export function parseLocalInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/.test(value)) return null;
  const d = new Date(value.length === 10 ? `${value}T00:00` : value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → "2026-05-01T10:30" for <input type="datetime-local">, in local time. */
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
