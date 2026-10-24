import { describe, expect, it } from "vitest";
import { detectAll, detectKind, detectTimeZone } from "./detectors";

describe("detectTimeZone", () => {
  it.each(["Europe/Madrid", "America/Argentina/Buenos_Aires", "UTC", "Asia/Kolkata"])("detects %s", (input) => {
    expect(detectTimeZone(input)?.kind).toBe("timezone");
    expect(detectKind(input)?.kind).toBe("timezone");
  });

  it.each(["Europe/Atlantis", "europe/madrid", "src/components", "Madrid", "a/b"])("ignores %s", (input) => {
    expect(detectTimeZone(input)).toBeNull();
  });
});

describe("time detectors keep working", () => {
  it("timestamps, ISO dates and cron expressions", () => {
    expect(detectKind("1700000000")?.kind).toBe("timestamp");
    expect(detectKind("2024-05-01T10:00:00Z")?.kind).toBe("iso-date");
    expect(detectKind("*/5 * * * *")?.kind).toBe("cron");
    expect(detectAll("0 9 * * 1-5").map((d) => d.kind)).toContain("cron");
  });
});
