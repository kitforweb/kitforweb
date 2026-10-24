/** Every IANA time zone the runtime knows (plus UTC). */
export function allTimeZones(): string[] {
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return zones.includes("UTC") ? zones : ["UTC", ...zones];
}

export function isTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** "America/Argentina/Buenos_Aires" → "Buenos Aires". */
export function cityName(zone: string): string {
  return (zone.split("/").pop() ?? zone).replace(/_/g, " ");
}

/** Offset of `zone` from UTC at `date`, in minutes (Madrid in summer: 120). */
export function zoneOffsetMinutes(date: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60_000);
}

export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/**
 * The instant at which the wall clock in `zone` shows `local` ("2026-03-29T02:30").
 * Handles DST: a time that does not exist (spring forward) moves forward.
 */
export function zonedTimeToUtc(local: string, zone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  let result = guess - zoneOffsetMinutes(new Date(guess), zone) * 60_000;
  // Second pass: the offset at the real instant may differ around DST changes.
  result = guess - zoneOffsetMinutes(new Date(result), zone) * 60_000;
  return new Date(result);
}

/** "2026-03-29T10:00" as shown by the wall clock in `zone` at `date`. */
export function toZonedLocalInput(date: Date, zone: string): string {
  const shifted = new Date(date.getTime() + zoneOffsetMinutes(date, zone) * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export interface ZoneTime {
  zone: string;
  city: string;
  time: string;
  date: string;
  offset: string;
  offsetMinutes: number;
  /** Difference in days with the reference zone's calendar date (-1, 0, +1). */
  dayShift: number;
  /** Working hours 9–18 on that zone's wall clock. */
  business: boolean;
}

export function timeInZones(date: Date, zones: string[], locale: string, reference: string): ZoneTime[] {
  const refDay = toZonedLocalInput(date, reference).slice(0, 10);
  return zones.map((zone) => {
    const offsetMinutes = zoneOffsetMinutes(date, zone);
    const local = toZonedLocalInput(date, zone);
    const hour = Number(local.slice(11, 13));
    return {
      zone,
      city: cityName(zone),
      // 24-hour clock everywhere: unambiguous when comparing zones.
      time: new Intl.DateTimeFormat(locale, {
        timeZone: zone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(date),
      date: new Intl.DateTimeFormat(locale, {
        timeZone: zone,
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(date),
      offset: formatOffset(offsetMinutes),
      offsetMinutes,
      dayShift: Math.round((Date.parse(local.slice(0, 10)) - Date.parse(refDay)) / 86_400_000),
      business: hour >= 9 && hour < 18,
    };
  });
}
