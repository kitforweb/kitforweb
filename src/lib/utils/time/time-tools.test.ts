import { describe, expect, it } from "vitest";
import { analyzeCron, buildCron, normalizeCron, splitCron } from "./cron";
import { dateDifference, parseLocalInput, shiftDate, toLocalInput } from "./diff";
import { dayOfYear, formatTime, guessEpochUnit, isoWeek, parseTimeInput, relativeTime } from "./timestamp";
import {
  cityName,
  formatOffset,
  isTimeZone,
  timeInZones,
  toZonedLocalInput,
  zonedTimeToUtc,
  zoneOffsetMinutes,
} from "./zones";

describe("Timestamp", () => {
  it("guesses the epoch unit by magnitude", () => {
    expect(guessEpochUnit(1_700_000_000)).toBe("s");
    expect(guessEpochUnit(1_700_000_000_000)).toBe("ms");
    expect(guessEpochUnit(1_700_000_000_000_000)).toBe("us");
    expect(guessEpochUnit(1.7e18)).toBe("ns");
  });

  it("parses epochs, ISO and RFC 2822", () => {
    expect(parseTimeInput("1700000000")).toMatchObject({ ok: true, unit: "s" });
    const ms = parseTimeInput("1700000000123");
    expect(ms.ok && ms.date.toISOString()).toBe("2023-11-14T22:13:20.123Z");
    expect(parseTimeInput("1700000000.5")).toMatchObject({ ok: true, unit: "s" });
    const iso = parseTimeInput("2024-02-29T12:00:00+02:00");
    expect(iso.ok && iso.date.toISOString()).toBe("2024-02-29T10:00:00.000Z");
    const rfc = parseTimeInput("Thu, 01 Jan 1970 00:00:00 GMT");
    expect(rfc.ok && rfc.date.getTime()).toBe(0);
    expect(parseTimeInput("-86400")).toMatchObject({ ok: true });
  });

  it("can force the unit", () => {
    const r = parseTimeInput("1700000000", "ms");
    expect(r.ok && r.date.toISOString()).toBe("1970-01-20T16:13:20.000Z");
  });

  it("rejects empty, invalid and out-of-range input", () => {
    expect(parseTimeInput(" ")).toEqual({ ok: false, error: "empty" });
    expect(parseTimeInput("yesterday-ish")).toEqual({ ok: false, error: "invalid" });
    expect(parseTimeInput("99999999999999999999999", "ms")).toEqual({ ok: false, error: "range" });
  });

  it("formats every representation", () => {
    const now = new Date("2024-01-01T12:00:00Z");
    const f = formatTime(new Date("2024-01-01T10:00:00Z"), "en", now, "UTC");
    expect(f).toMatchObject({
      seconds: "1704103200",
      milliseconds: "1704103200000",
      iso: "2024-01-01T10:00:00.000Z",
      relative: "2 hours ago",
      dayOfWeek: "Monday",
      week: 1,
      dayOfYear: 1,
    });
    expect(f.local).toContain("2024");
    expect(relativeTime(new Date("2024-01-04T12:00:00Z"), now, "es")).toBe("dentro de 3 días");
  });

  it("computes ISO weeks and days of the year", () => {
    expect(isoWeek(new Date("2021-01-03T00:00:00Z"))).toBe(53);
    expect(isoWeek(new Date("2024-12-30T00:00:00Z"))).toBe(1);
    expect(dayOfYear(new Date("2024-12-31T00:00:00Z"))).toBe(366);
  });
});

describe("Time zones", () => {
  it("validates zones and extracts city names", () => {
    expect(isTimeZone("Europe/Madrid")).toBe(true);
    expect(isTimeZone("Mars/Olympus")).toBe(false);
    expect(cityName("America/Argentina/Buenos_Aires")).toBe("Buenos Aires");
  });

  it("knows the offset, including daylight saving time", () => {
    expect(zoneOffsetMinutes(new Date("2024-01-15T12:00:00Z"), "Europe/Madrid")).toBe(60);
    expect(zoneOffsetMinutes(new Date("2024-07-15T12:00:00Z"), "Europe/Madrid")).toBe(120);
    expect(zoneOffsetMinutes(new Date("2024-07-15T12:00:00Z"), "Asia/Kolkata")).toBe(330);
    expect(formatOffset(330)).toBe("UTC+05:30");
    expect(formatOffset(-180)).toBe("UTC-03:00");
  });

  it("converts a wall-clock time in a zone to an instant and back", () => {
    expect(zonedTimeToUtc("2024-07-15T09:00", "Europe/Madrid")?.toISOString()).toBe("2024-07-15T07:00:00.000Z");
    expect(zonedTimeToUtc("2024-01-15T09:00", "America/New_York")?.toISOString()).toBe("2024-01-15T14:00:00.000Z");
    expect(toZonedLocalInput(new Date("2024-07-15T07:00:00Z"), "Europe/Madrid")).toBe("2024-07-15T09:00");
    expect(zonedTimeToUtc("not a date", "UTC")).toBeNull();
  });

  it("shows a meeting time across zones with day shifts", () => {
    const rows = timeInZones(
      new Date("2024-07-15T22:30:00Z"),
      ["Europe/Madrid", "Asia/Tokyo", "America/Los_Angeles"],
      "en-GB",
      "Europe/Madrid",
    );
    expect(rows.map((r) => r.time)).toEqual(["00:30", "07:30", "15:30"]);
    expect(rows.map((r) => r.dayShift)).toEqual([0, 0, -1]);
    expect(rows.map((r) => r.business)).toEqual([false, false, true]);
  });
});

describe("Date difference", () => {
  it("breaks the interval down and gives totals", () => {
    const d = dateDifference(new Date("2024-01-01T00:00:00Z"), new Date("2025-03-15T06:30:00Z"));
    expect(d.parts).toEqual({ years: 1, months: 2, days: 14, hours: 6, minutes: 30, seconds: 0 });
    expect(d.totalDays).toBe(439);
    expect(d.negative).toBe(false);
  });

  it("counts business days and handles reversed dates", () => {
    // Monday 1 to Monday 8 January 2024: 5 working days.
    expect(dateDifference(new Date("2024-01-01T00:00:00Z"), new Date("2024-01-08T00:00:00Z")).businessDays).toBe(5);
    const r = dateDifference(new Date("2024-01-10T00:00:00Z"), new Date("2024-01-01T00:00:00Z"));
    expect(r.negative).toBe(true);
    expect(r.totalDays).toBe(-9);
    expect(r.parts.days).toBe(9);
  });

  it("adds and subtracts calendar durations", () => {
    expect(shiftDate(new Date("2024-01-31T00:00:00Z"), { months: 1 }).toISOString()).toBe("2024-02-29T00:00:00.000Z");
    expect(shiftDate(new Date("2024-03-01T00:00:00Z"), { days: 1 }, true).toISOString()).toBe(
      "2024-02-29T00:00:00.000Z",
    );
    expect(shiftDate(new Date("2024-01-01T00:00:00Z"), { weeks: 2, hours: 3, years: Number.NaN }).toISOString()).toBe(
      "2024-01-15T03:00:00.000Z",
    );
  });

  it("parses and writes datetime-local values", () => {
    expect(parseLocalInput("2024-05-01")?.toISOString()).toBe("2024-05-01T00:00:00.000Z");
    expect(parseLocalInput("2024-05-01T10:30")?.toISOString()).toBe("2024-05-01T10:30:00.000Z");
    expect(parseLocalInput("2024-13-01")).toBeNull();
    expect(parseLocalInput("tomorrow")).toBeNull();
    expect(toLocalInput(new Date("2024-05-01T10:30:00Z"))).toBe("2024-05-01T10:30");
  });
});

describe("Cron", () => {
  const from = new Date("2026-01-05T08:00:00Z"); // a Monday

  it("explains expressions in several languages", () => {
    const en = analyzeCron("*/15 9-17 * * 1-5", "en", { from });
    expect(en.ok && en.description).toBe("Every 15 minutes, between 09:00 AM and 05:59 PM, Monday through Friday");
    const es = analyzeCron("*/15 9-17 * * 1-5", "es", { from });
    expect(es.ok && es.description).toBe("Cada 15 minutos, entre las 09:00 y las 17:59, de lunes a viernes");
    const pt = analyzeCron("0 9 * * 1", "pt", { from });
    expect(pt.ok && pt.description).toContain("09:00");
  });

  it("lists the next runs, honouring the time zone", () => {
    const r = analyzeCron("0 9 * * 1-5", "en", { from, count: 3, tz: "UTC" });
    expect(r.ok && r.next.map((d) => d.toISOString())).toEqual([
      "2026-01-05T09:00:00.000Z",
      "2026-01-06T09:00:00.000Z",
      "2026-01-07T09:00:00.000Z",
    ]);
    const madrid = analyzeCron("0 9 * * *", "en", { from, count: 1, tz: "Europe/Madrid" });
    expect(madrid.ok && madrid.next[0].toISOString()).toBe("2026-01-06T08:00:00.000Z");
  });

  it("supports macros and seconds", () => {
    expect(normalizeCron("  @daily ")).toBe("0 0 * * *");
    const r = analyzeCron("30 */5 * * * *", "en", { from, count: 2 });
    expect(r.ok && r.fields).toBe(6);
  });

  it("builds and splits expressions", () => {
    expect(buildCron({ minute: "0", hour: "9", dayOfMonth: "", month: "*", dayOfWeek: "1-5" })).toBe("0 9 * * 1-5");
    expect(splitCron("@hourly")).toEqual({ minute: "0", hour: "*", dayOfMonth: "*", month: "*", dayOfWeek: "*" });
    expect(splitCron("* * *")).toBeNull();
  });

  it("rejects invalid expressions", () => {
    expect(analyzeCron("", "en").ok).toBe(false);
    expect(analyzeCron("* * *", "en").ok).toBe(false);
    expect(analyzeCron("61 * * * *", "en").ok).toBe(false);
    expect(analyzeCron("* * * * 9", "en").ok).toBe(false);
  });
});
