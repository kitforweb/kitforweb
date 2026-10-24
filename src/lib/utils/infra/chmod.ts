/** Unix permission bits: three classes of read/write/execute plus setuid, setgid and sticky. */
export type PermClass = "user" | "group" | "other";
export type PermBit = "read" | "write" | "execute";

export interface Permissions {
  user: Record<PermBit, boolean>;
  group: Record<PermBit, boolean>;
  other: Record<PermBit, boolean>;
  setuid: boolean;
  setgid: boolean;
  sticky: boolean;
}

export type ChmodResult = { ok: true; perms: Permissions } | { ok: false; error: "invalid" };

export const CLASSES: readonly PermClass[] = ["user", "group", "other"];
export const BITS: readonly PermBit[] = ["read", "write", "execute"];

const bits = (n: number): Record<PermBit, boolean> => ({
  read: (n & 4) !== 0,
  write: (n & 2) !== 0,
  execute: (n & 1) !== 0,
});

export function fromOctal(mode: number): Permissions {
  return {
    setuid: (mode & 0o4000) !== 0,
    setgid: (mode & 0o2000) !== 0,
    sticky: (mode & 0o1000) !== 0,
    user: bits((mode >> 6) & 7),
    group: bits((mode >> 3) & 7),
    other: bits(mode & 7),
  };
}

export function toNumber(p: Permissions): number {
  const n = (c: Record<PermBit, boolean>) => (c.read ? 4 : 0) + (c.write ? 2 : 0) + (c.execute ? 1 : 0);
  return (
    (p.setuid ? 0o4000 : 0) +
    (p.setgid ? 0o2000 : 0) +
    (p.sticky ? 0o1000 : 0) +
    (n(p.user) << 6) +
    (n(p.group) << 3) +
    n(p.other)
  );
}

/** "755", or "4755" when a special bit is set. */
export function toOctal(p: Permissions): string {
  const n = toNumber(p);
  return n > 0o777 ? n.toString(8).padStart(4, "0") : n.toString(8).padStart(3, "0");
}

/** "rwxr-xr-x" as `ls -l` shows it, with s/S/t/T for the special bits. */
export function toSymbolic(p: Permissions): string {
  const cls = (c: Record<PermBit, boolean>, special: boolean, letter: "s" | "t") =>
    (c.read ? "r" : "-") +
    (c.write ? "w" : "-") +
    (special ? (c.execute ? letter : letter.toUpperCase()) : c.execute ? "x" : "-");
  return cls(p.user, p.setuid, "s") + cls(p.group, p.setgid, "s") + cls(p.other, p.sticky, "t");
}

/** Parses "755", "0644", "4755", "rwxr-xr-x", "-rw-r--r--" (ls -l) or "drwxrwsr-x.". */
export function parseMode(text: string): ChmodResult {
  const t = text.trim();
  if (/^0?[0-7]{3}$/.test(t) || /^[0-7]{4}$/.test(t)) return { ok: true, perms: fromOctal(parseInt(t, 8)) };
  const m = /^[-dlcbps]?([r-][w-][xsS-])([r-][w-][xsS-])([r-][w-][xtT-])[.+@]?$/.exec(t);
  if (!m) return { ok: false, error: "invalid" };
  const cls = (s: string): Record<PermBit, boolean> => ({
    read: s[0] === "r",
    write: s[1] === "w",
    execute: /[xst]/.test(s[2]),
  });
  return {
    ok: true,
    perms: {
      user: cls(m[1]),
      group: cls(m[2]),
      other: cls(m[3]),
      setuid: /[sS]/.test(m[1][2]),
      setgid: /[sS]/.test(m[2][2]),
      sticky: /[tT]/.test(m[3][2]),
    },
  };
}

const clone = (p: Permissions): Permissions => ({
  ...p,
  user: { ...p.user },
  group: { ...p.group },
  other: { ...p.other },
});

/**
 * Applies a symbolic chmod expression ("u+x,go-w", "a=r", "+x") to `base`.
 * Returns null when the expression is not valid. Without a class, `a` is assumed.
 */
export function applySymbolic(base: Permissions, expr: string): Permissions | null {
  const p = clone(base);
  for (const clause of expr.trim().split(",")) {
    const m = /^([ugoa]*)([-+=])([rwxXst]*)$/.exec(clause.trim());
    if (!m) return null;
    const who = m[1] === "" || m[1].includes("a") ? "ugo" : m[1];
    const op = m[2];
    const perms = m[3];
    const isDirOrExec = p.user.execute || p.group.execute || p.other.execute;
    for (const w of who) {
      const cls = p[w === "u" ? "user" : w === "g" ? "group" : "other"];
      const set = (bit: PermBit, on: boolean) => {
        if (op === "+") cls[bit] = cls[bit] || on;
        else if (op === "-") cls[bit] = cls[bit] && !on;
        else cls[bit] = on;
      };
      set("read", perms.includes("r"));
      set("write", perms.includes("w"));
      set("execute", perms.includes("x") || (perms.includes("X") && isDirOrExec));
      const special = perms.includes("s");
      if (w === "u") p.setuid = op === "+" ? p.setuid || special : op === "-" ? p.setuid && !special : special;
      if (w === "g") p.setgid = op === "+" ? p.setgid || special : op === "-" ? p.setgid && !special : special;
    }
    if (who.includes("o")) {
      const sticky = perms.includes("t");
      p.sticky = op === "+" ? p.sticky || sticky : op === "-" ? p.sticky && !sticky : sticky;
    }
  }
  return p;
}

/** Common modes and what they are typically used for (keys of the i18n "presets" namespace). */
export const PRESETS = ["644", "755", "600", "700", "640", "775", "777", "400", "1777", "2775"] as const;

/** Risks worth pointing out: writable by everyone, setuid… (keys of the i18n "risks" namespace). */
export function risks(p: Permissions): string[] {
  const out: string[] = [];
  if (p.other.write && !p.sticky) out.push("world-writable");
  if (p.setuid) out.push("setuid");
  if (p.setgid) out.push("setgid");
  if (!p.user.read && (p.group.read || p.other.read)) out.push("owner-less");
  return out;
}

export type ChmodInput =
  | { ok: true; perms: Permissions; source: "mode" | "expression"; recursive: boolean; target?: string }
  | { ok: false; error: "invalid" };

/** The default mode of a new file (umask 022), base for relative expressions. */
export const FILE_DEFAULT = 0o644;

/**
 * Reads what a user may paste: a mode ("755", "rwxr-xr-x"), a symbolic
 * expression ("u+x,go-w", applied to 644) or a whole `chmod [-R] MODE file`.
 */
export function parseChmodInput(text: string): ChmodInput {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  let recursive = false;
  let target: string | undefined;
  let mode = tokens[0] ?? "";
  if (mode === "chmod" || mode === "sudo") {
    const args = tokens.slice(tokens[0] === "sudo" ? 2 : 1);
    const opts = args.filter((a) => /^-[A-Za-z]+$/.test(a) || a.startsWith("--"));
    recursive = opts.some((o) => /^-[A-Za-z]*R/.test(o) || o === "--recursive");
    const rest = args.filter((a) => !opts.includes(a));
    mode = rest[0] ?? "";
    target = rest.slice(1).join(" ") || undefined;
  } else if (tokens.length > 1) return { ok: false, error: "invalid" };

  const direct = parseMode(mode);
  if (direct.ok) return { ok: true, perms: direct.perms, source: "mode", recursive, target };
  const applied = mode ? applySymbolic(fromOctal(FILE_DEFAULT), mode) : null;
  return applied
    ? { ok: true, perms: applied, source: "expression", recursive, target }
    : { ok: false, error: "invalid" };
}

/** "u=rwx,g=rx,o=" style expression equivalent to `p` (special bits as s and t). */
export function symbolicExpression(p: Permissions): string {
  const part = (c: Record<PermBit, boolean>, special: string) =>
    (c.read ? "r" : "") + (c.write ? "w" : "") + (c.execute ? "x" : "") + special;
  return [
    `u=${part(p.user, p.setuid ? "s" : "")}`,
    `g=${part(p.group, p.setgid ? "s" : "")}`,
    `o=${part(p.other, p.sticky ? "t" : "")}`,
  ].join(",");
}
