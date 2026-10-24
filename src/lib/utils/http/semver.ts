import semver from "semver";

export type RangeCheck =
  | { ok: true; satisfies: boolean; comparators: string[][]; min: string | null }
  | { ok: false; error: "range" | "version" };

/**
 * Does `version` satisfy `range`? Also returns the range expanded to plain
 * comparators (^1.2.3 → >=1.2.3 <2.0.0-0) and the lowest version it accepts.
 */
export function checkRange(version: string, range: string, includePrerelease = false): RangeCheck {
  const r = semver.validRange(range.trim(), { includePrerelease });
  if (!r) return { ok: false, error: "range" };
  // "v1.2" or "1.2" are coerced to 1.2.0, like npm does.
  const exact = semver.valid(version.trim()) ?? semver.coerce(version.trim(), { includePrerelease: true })?.version;
  if (!exact) return { ok: false, error: "version" };
  const parsed = new semver.Range(range.trim(), { includePrerelease });
  return {
    ok: true,
    satisfies: semver.satisfies(exact, parsed, { includePrerelease }),
    comparators: parsed.set.map((set) => set.map((c) => c.value || "*")),
    min: semver.minVersion(parsed)?.version ?? null,
  };
}

export type SortResult = { ok: true; sorted: string[]; invalid: string[] };

/** Sorts versions semantically (1.10.0 after 1.9.0); invalid lines are reported. */
export function sortVersions(list: string[], descending = false): SortResult {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const raw of list.map((l) => l.trim()).filter(Boolean)) {
    const clean = semver.clean(raw, { loose: true });
    if (clean) valid.push(clean);
    else invalid.push(raw);
  }
  const sorted = descending ? semver.rsort(valid) : semver.sort(valid);
  return { ok: true, sorted, invalid };
}

export type ReleaseType = ReturnType<typeof semver.diff>;

/** Which part changed between two versions (major, minor, patch, prerelease…). */
export function versionDiff(a: string, b: string): ReleaseType | "invalid" {
  if (!semver.valid(a) || !semver.valid(b)) return "invalid";
  return semver.diff(a, b);
}

export function bump(version: string, type: "major" | "minor" | "patch" | "prerelease", preid = "beta"): string | null {
  return semver.inc(version, type, preid);
}
