/** IPv4 and IPv6 addresses as BigInt, so both versions share the same arithmetic. */
export type IpVersion = 4 | 6;

export interface IpAddress {
  version: IpVersion;
  value: bigint;
}

export type AddressScope =
  | "private"
  | "public"
  | "loopback"
  | "link-local"
  | "multicast"
  | "cgnat"
  | "documentation"
  | "unspecified"
  | "unique-local"
  | "broadcast";

export interface CidrInfo {
  version: IpVersion;
  /** The address as written, normalised. */
  input: string;
  prefix: number;
  network: string;
  /** Netmask in dotted form (IPv4) or as a full IPv6 address. */
  netmask: string;
  /** Inverse mask, as used by Cisco ACLs (IPv4 only). */
  wildcard?: string;
  broadcast?: string;
  firstHost: string;
  lastHost: string;
  /** Total addresses in the block, as a decimal string (IPv6 sizes overflow numbers). */
  total: string;
  /** Usable host addresses (excludes network and broadcast in IPv4 blocks larger than /31). */
  usable: string;
  /** True when the address had host bits set and was moved to the network address. */
  normalized: boolean;
  scope: AddressScope;
  /** Mask in binary, octet by octet (IPv4 only). */
  binaryMask?: string;
}

export type CidrResult =
  { ok: true; info: CidrInfo } | { ok: false; error: "invalid-address" | "invalid-prefix" | "empty" };

const BITS = { 4: 32, 6: 128 } as const;

export function parseIpv4(text: string): bigint | null {
  const parts = text.split(".");
  if (parts.length !== 4) return null;
  let value = 0n;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || (p.length > 1 && p.startsWith("0"))) return null;
    const n = Number(p);
    if (n > 255) return null;
    value = (value << 8n) | BigInt(n);
  }
  return value;
}

export function parseIpv6(text: string): bigint | null {
  let t = text.toLowerCase();
  const zone = t.indexOf("%");
  if (zone >= 0) t = t.slice(0, zone);
  // An embedded IPv4 tail (::ffff:192.168.1.1) becomes two hextets.
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(t);
  if (v4) {
    const n = parseIpv4(v4[1]);
    if (n === null) return null;
    t = t.slice(0, -v4[1].length) + `${(n >> 16n).toString(16)}:${(n & 0xffffn).toString(16)}`;
  }
  const halves = t.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  let value = 0n;
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    value = (value << 16n) | BigInt(parseInt(g, 16));
  }
  return value;
}

export function parseIp(text: string): IpAddress | null {
  const t = text.trim().replace(/^\[|\]$/g, "");
  if (t.includes(":")) {
    const v = parseIpv6(t);
    return v === null ? null : { version: 6, value: v };
  }
  const v = parseIpv4(t);
  return v === null ? null : { version: 4, value: v };
}

export function formatIp(ip: IpAddress): string {
  if (ip.version === 4) {
    return [24n, 16n, 8n, 0n].map((s) => ((ip.value >> s) & 255n).toString()).join(".");
  }
  const groups = Array.from({ length: 8 }, (_, i) => Number((ip.value >> BigInt((7 - i) * 16)) & 0xffffn));
  // RFC 5952: compress the longest run (at least two) of zero groups.
  let best = -1;
  let bestLen = 1;
  for (let i = 0; i < 8;) {
    if (groups[i] !== 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && groups[j] === 0) j++;
    if (j - i > bestLen) {
      best = i;
      bestLen = j - i;
    }
    i = j;
  }
  const hex = groups.map((g) => g.toString(16));
  if (best < 0) return hex.join(":");
  return `${hex.slice(0, best).join(":")}::${hex.slice(best + bestLen).join(":")}`;
}

const maskOf = (version: IpVersion, prefix: number) => {
  const bits = BigInt(BITS[version]);
  return ((1n << bits) - 1n) ^ ((1n << (bits - BigInt(prefix))) - 1n);
};

function inRange(value: bigint, base: string, prefix: number): boolean {
  const ip = parseIp(base)!;
  const mask = maskOf(ip.version, prefix);
  return (value & mask) === (ip.value & mask);
}

export function addressScope(ip: IpAddress): AddressScope {
  const v = ip.value;
  if (ip.version === 4) {
    if (v === 0n) return "unspecified";
    if (v === 0xffffffffn) return "broadcast";
    if (inRange(v, "127.0.0.0", 8)) return "loopback";
    if (inRange(v, "10.0.0.0", 8) || inRange(v, "172.16.0.0", 12) || inRange(v, "192.168.0.0", 16)) return "private";
    if (inRange(v, "100.64.0.0", 10)) return "cgnat";
    if (inRange(v, "169.254.0.0", 16)) return "link-local";
    if (inRange(v, "224.0.0.0", 4)) return "multicast";
    if (inRange(v, "192.0.2.0", 24) || inRange(v, "198.51.100.0", 24) || inRange(v, "203.0.113.0", 24))
      return "documentation";
    return "public";
  }
  if (v === 0n) return "unspecified";
  if (v === 1n) return "loopback";
  if (inRange(v, "fe80::", 10)) return "link-local";
  if (inRange(v, "fc00::", 7)) return "unique-local";
  if (inRange(v, "ff00::", 8)) return "multicast";
  if (inRange(v, "2001:db8::", 32)) return "documentation";
  return "public";
}

/** Splits "10.0.0.0/24", "10.0.0.1 255.255.255.0" or a bare address (/32, /128). */
export function parseCidr(text: string): CidrResult {
  const t = text.trim();
  if (!t) return { ok: false, error: "empty" };
  const m = /^(\S+?)(?:\s*\/\s*(\d+)|\s+(\d+\.\d+\.\d+\.\d+))?$/.exec(t);
  if (!m) return { ok: false, error: "invalid-address" };
  const ip = parseIp(m[1]);
  if (!ip) return { ok: false, error: "invalid-address" };
  const bits = BITS[ip.version];
  let prefix: number = bits;
  if (m[2] !== undefined) prefix = Number(m[2]);
  else if (m[3] !== undefined) {
    if (ip.version !== 4) return { ok: false, error: "invalid-prefix" };
    const p = netmaskToPrefix(m[3]);
    if (p === null) return { ok: false, error: "invalid-prefix" };
    prefix = p;
  }
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > bits) return { ok: false, error: "invalid-prefix" };

  const mask = maskOf(ip.version, prefix);
  const all = (1n << BigInt(bits)) - 1n;
  const network = ip.value & mask;
  const last = network | (all ^ mask);
  const total = last - network + 1n;
  const v4 = ip.version === 4;
  // IPv4 reserves the network and broadcast addresses, except in /31 (RFC 3021) and /32.
  const reserve = v4 && prefix < 31;
  const first = reserve ? network + 1n : network;
  const lastHost = reserve ? last - 1n : last;
  const fmt = (value: bigint) => formatIp({ version: ip.version, value });

  const info: CidrInfo = {
    version: ip.version,
    input: `${fmt(ip.value)}/${prefix}`,
    prefix,
    network: fmt(network),
    netmask: fmt(mask),
    firstHost: fmt(first),
    lastHost: fmt(lastHost),
    total: total.toString(),
    usable: (reserve ? total - 2n : total).toString(),
    normalized: network !== ip.value,
    scope: addressScope({ version: ip.version, value: network }),
  };
  if (v4) {
    info.wildcard = fmt(all ^ mask);
    info.broadcast = fmt(last);
    info.binaryMask = [24n, 16n, 8n, 0n].map((s) => ((mask >> s) & 255n).toString(2).padStart(8, "0")).join(".");
  }
  return { ok: true, info };
}

/** "255.255.255.0" → 24; null when the mask has holes. */
export function netmaskToPrefix(mask: string): number | null {
  const v = parseIpv4(mask);
  if (v === null) return null;
  const bin = v.toString(2).padStart(32, "0");
  return /^1*0*$/.test(bin) ? (bin.indexOf("0") === -1 ? 32 : bin.indexOf("0")) : null;
}

export type ContainsResult =
  { ok: true; contains: boolean } | { ok: false; error: "invalid-address" | "version-mismatch" };

/** Whether `address` belongs to the block. */
export function cidrContains(info: CidrInfo, address: string): ContainsResult {
  const ip = parseIp(address);
  if (!ip) return { ok: false, error: "invalid-address" };
  if (ip.version !== info.version) return { ok: false, error: "version-mismatch" };
  const mask = maskOf(info.version, info.prefix);
  return { ok: true, contains: (ip.value & mask) === parseIp(info.network)!.value };
}

/** Divides the block into subnets of `newPrefix`, up to `limit` of them. */
export function splitCidr(info: CidrInfo, newPrefix: number, limit = 256): { subnets: string[]; total: string } | null {
  const bits = BITS[info.version];
  if (!Number.isInteger(newPrefix) || newPrefix < info.prefix || newPrefix > bits) return null;
  const count = 1n << BigInt(newPrefix - info.prefix);
  const step = 1n << BigInt(bits - newPrefix);
  const base = parseIp(info.network)!.value;
  const subnets: string[] = [];
  for (let i = 0n; i < count && i < BigInt(limit); i++) {
    subnets.push(`${formatIp({ version: info.version, value: base + i * step })}/${newPrefix}`);
  }
  return { subnets, total: count.toString() };
}
