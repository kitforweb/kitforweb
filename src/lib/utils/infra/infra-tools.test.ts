import { describe, expect, it } from "vitest";
import {
  applySymbolic,
  fromOctal,
  parseChmodInput,
  parseMode,
  risks,
  symbolicExpression,
  toOctal,
  toSymbolic,
} from "./chmod";
import { addressScope, cidrContains, formatIp, netmaskToPrefix, parseCidr, parseIp, splitCidr } from "./cidr";
import { parseDockerRun, toCompose, yamlScalar } from "./docker-compose";
import { envToObject, envValue, jsonToEnv, parseEnv } from "./dotenv";

const compose = (cmd: string) => {
  const r = parseDockerRun(cmd);
  if (!r.ok) throw new Error(r.error);
  return toCompose(r.compose);
};

describe("docker run → compose", () => {
  it("maps the common flags", () => {
    const out = compose(
      `docker run -d --name web -p 8080:80 -e NODE_ENV=production -v ./site:/usr/share/nginx/html:ro --restart unless-stopped nginx:1.27`,
    );
    expect(out).toBe(
      [
        "services:",
        "  web:",
        "    image: nginx:1.27",
        "    container_name: web",
        "    restart: unless-stopped",
        "    ports:",
        '      - "8080:80"',
        "    environment:",
        "      NODE_ENV: production",
        "    volumes:",
        "      - ./site:/usr/share/nginx/html:ro",
        "",
      ].join("\n"),
    );
  });

  it("handles continuations, grouped short flags and --flag=value", () => {
    const out = compose(`docker run -dit \\\n  --name=api \\\n  -p3000:3000 \\\n  node:22 npm start`);
    expect(out).toContain("  api:\n    image: node:22");
    expect(out).toContain("    stdin_open: true\n    tty: true");
    expect(out).toContain('      - "3000:3000"');
    expect(out).toContain("    command:\n      - npm\n      - start");
  });

  it("declares named volumes and external networks at the top level", () => {
    const out = compose("docker run -v pgdata:/var/lib/postgresql/data --network backend postgres:16");
    expect(out).toContain("volumes:\n  pgdata: {}");
    expect(out).toContain("networks:\n  backend:\n    external: true");
    expect(out).toContain("    networks:\n      - backend");
  });

  it("uses network_mode for host networking", () => {
    expect(compose("docker run --network host traefik")).toContain("network_mode: host");
  });

  it("converts several commands into several services with unique names", () => {
    const r = parseDockerRun("docker run redis\ndocker run redis:7");
    expect(r.ok && r.compose.services.map((s) => s.name)).toEqual(["redis", "redis-2"]);
  });

  it("builds healthcheck, logging, ulimits and GPU reservations", () => {
    const out = compose(
      "docker run --health-cmd 'curl -f http://localhost' --health-interval 30s --health-retries 3 --log-opt max-size=10m --ulimit nofile=1024:2048 --gpus all img",
    );
    expect(out).toContain('    healthcheck:\n      test:\n        - CMD-SHELL\n        - "curl -f http://localhost"');
    expect(out).toContain("      retries: 3");
    expect(out).toContain("    logging:\n      options:\n        max-size: 10m");
    expect(out).toContain("      nofile:\n        soft: 1024\n        hard: 2048");
    expect(out).toContain("          devices:\n            - driver: nvidia\n              count: all");
  });

  it("keeps --mount as long syntax and environment without values as a list", () => {
    const out = compose("docker run --mount type=volume,source=cache,target=/cache -e TOKEN -e A=1 busybox");
    expect(out).toContain("      - type: volume\n        source: cache\n        target: /cache");
    expect(out).toContain("    environment:\n      - TOKEN\n      - A=1");
    expect(out).toContain("volumes:\n  cache: {}");
  });

  it("reports flags without equivalent and accepts sudo / docker container run", () => {
    const r = parseDockerRun("sudo docker container run --rm --weird-flag x alpine");
    expect(r.ok && r.compose.ignored).toEqual(["--weird-flag"]);
  });

  it("rejects other commands, missing images and broken quotes", () => {
    expect(parseDockerRun("docker ps")).toMatchObject({ ok: false, error: "not-docker-run" });
    expect(parseDockerRun("docker run -d -p 80:80")).toMatchObject({ ok: false, error: "no-image" });
    expect(parseDockerRun("docker run -e 'A=1 nginx")).toMatchObject({ ok: false, error: "quotes" });
    expect(parseDockerRun("   ")).toMatchObject({ ok: false, error: "not-docker-run" });
  });

  it("quotes YAML scalars that would change meaning", () => {
    expect(yamlScalar("nginx")).toBe("nginx");
    expect(yamlScalar("yes")).toBe('"yes"');
    expect(yamlScalar("80:80")).toBe('"80:80"');
    expect(yamlScalar("1.5")).toBe('"1.5"');
    expect(yamlScalar("0x1F")).toBe('"0x1F"');
    expect(yamlScalar("nginx:1.27")).toBe("nginx:1.27");
    expect(yamlScalar("30s")).toBe("30s");
    expect(yamlScalar("key:")).toBe('"key:"');
    expect(yamlScalar("a b")).toBe('"a b"');
    expect(yamlScalar("")).toBe('""');
    expect(yamlScalar(2)).toBe("2");
  });
});

describe("CIDR", () => {
  it("describes an IPv4 block", () => {
    const r = parseCidr("192.168.1.0/24");
    expect(r.ok && r.info).toMatchObject({
      network: "192.168.1.0",
      netmask: "255.255.255.0",
      wildcard: "0.0.0.255",
      broadcast: "192.168.1.255",
      firstHost: "192.168.1.1",
      lastHost: "192.168.1.254",
      total: "256",
      usable: "254",
      scope: "private",
      normalized: false,
      binaryMask: "11111111.11111111.11111111.00000000",
    });
  });

  it("normalises host bits and accepts a dotted netmask", () => {
    const r = parseCidr("10.1.2.3 255.255.0.0");
    expect(r.ok && r.info.network).toBe("10.1.0.0");
    expect(r.ok && r.info.prefix).toBe(16);
    expect(r.ok && r.info.normalized).toBe(true);
  });

  it("handles /31, /32 and /0", () => {
    const r31 = parseCidr("10.0.0.0/31");
    expect(r31.ok && [r31.info.firstHost, r31.info.lastHost, r31.info.usable]).toEqual(["10.0.0.0", "10.0.0.1", "2"]);
    const r32 = parseCidr("8.8.8.8");
    expect(r32.ok && [r32.info.prefix, r32.info.usable, r32.info.scope]).toEqual([32, "1", "public"]);
    const r0 = parseCidr("0.0.0.0/0");
    expect(r0.ok && r0.info.total).toBe("4294967296");
  });

  it("describes an IPv6 block", () => {
    const r = parseCidr("2001:db8:abcd:12::1/64");
    expect(r.ok && r.info).toMatchObject({
      version: 6,
      network: "2001:db8:abcd:12::",
      lastHost: "2001:db8:abcd:12:ffff:ffff:ffff:ffff",
      total: "18446744073709551616",
      scope: "documentation",
    });
  });

  it("parses and formats IPv6 like RFC 5952", () => {
    expect(formatIp(parseIp("2001:0db8:0000:0000:0000:ff00:0042:8329")!)).toBe("2001:db8::ff00:42:8329");
    expect(formatIp(parseIp("::1")!)).toBe("::1");
    expect(formatIp(parseIp("::ffff:192.168.1.1")!)).toBe("::ffff:c0a8:101");
    expect(parseIp("1::2::3")).toBeNull();
    expect(parseIp("12345::")).toBeNull();
  });

  it("checks membership", () => {
    const r = parseCidr("172.16.0.0/12");
    if (!r.ok) throw new Error();
    expect(cidrContains(r.info, "172.31.255.1")).toEqual({ ok: true, contains: true });
    expect(cidrContains(r.info, "172.32.0.1")).toEqual({ ok: true, contains: false });
    expect(cidrContains(r.info, "::1")).toEqual({ ok: false, error: "version-mismatch" });
    expect(cidrContains(r.info, "300.1.1.1")).toEqual({ ok: false, error: "invalid-address" });
  });

  it("splits into subnets", () => {
    const r = parseCidr("10.0.0.0/24");
    if (!r.ok) throw new Error();
    expect(splitCidr(r.info, 26)).toEqual({
      subnets: ["10.0.0.0/26", "10.0.0.64/26", "10.0.0.128/26", "10.0.0.192/26"],
      total: "4",
    });
    expect(splitCidr(r.info, 8)).toBeNull();
    expect(splitCidr(r.info, 32, 3)?.subnets).toHaveLength(3);
  });

  it("classifies address scopes", () => {
    expect(addressScope(parseIp("100.64.1.1")!)).toBe("cgnat");
    expect(addressScope(parseIp("169.254.0.5")!)).toBe("link-local");
    expect(addressScope(parseIp("127.0.0.1")!)).toBe("loopback");
    expect(addressScope(parseIp("fd12::1")!)).toBe("unique-local");
    expect(addressScope(parseIp("224.0.0.251")!)).toBe("multicast");
  });

  it("rejects invalid input", () => {
    expect(parseCidr("")).toEqual({ ok: false, error: "empty" });
    expect(parseCidr("10.0.0/24")).toEqual({ ok: false, error: "invalid-address" });
    expect(parseCidr("010.0.0.1")).toEqual({ ok: false, error: "invalid-address" });
    expect(parseCidr("10.0.0.0/33")).toEqual({ ok: false, error: "invalid-prefix" });
    expect(parseCidr("10.0.0.0 255.0.255.0")).toEqual({ ok: false, error: "invalid-prefix" });
    expect(netmaskToPrefix("255.255.255.255")).toBe(32);
    expect(netmaskToPrefix("0.0.0.0")).toBe(0);
  });
});

const toNumberOf = (p: Parameters<typeof toOctal>[0]) => parseInt(toOctal(p), 8);

describe("chmod", () => {
  it("converts between octal and symbolic", () => {
    const p = parseMode("755");
    expect(p.ok && toSymbolic(p.perms)).toBe("rwxr-xr-x");
    const q = parseMode("-rw-r--r--");
    expect(q.ok && toOctal(q.perms)).toBe("644");
    expect(toOctal(fromOctal(0o600))).toBe("600");
  });

  it("handles special bits", () => {
    expect(toSymbolic(fromOctal(0o4755))).toBe("rwsr-xr-x");
    expect(toSymbolic(fromOctal(0o1777))).toBe("rwxrwxrwt");
    expect(toSymbolic(fromOctal(0o2644))).toBe("rw-r-Sr--");
    const d = parseMode("drwxrwsr-x.");
    expect(d.ok && toOctal(d.perms)).toBe("2775");
    expect(toOctal(fromOctal(0))).toBe("000");
  });

  it("applies symbolic expressions", () => {
    const base = fromOctal(0o644);
    expect(toOctal(applySymbolic(base, "u+x")!)).toBe("744");
    expect(toOctal(applySymbolic(base, "go-r")!)).toBe("600");
    expect(toOctal(applySymbolic(base, "+x")!)).toBe("755");
    expect(toOctal(applySymbolic(base, "a=rw,o-w")!)).toBe("664");
    expect(toOctal(applySymbolic(fromOctal(0o755), "u+s")!)).toBe("4755");
    expect(toOctal(applySymbolic(fromOctal(0o777), "+t")!)).toBe("1777");
    expect(toOctal(applySymbolic(base, "a+X")!)).toBe("644");
    expect(applySymbolic(base, "z+x")).toBeNull();
  });

  it("writes an equivalent symbolic expression that round-trips", () => {
    expect(symbolicExpression(fromOctal(0o750))).toBe("u=rwx,g=rx,o=");
    expect(symbolicExpression(fromOctal(0o4755))).toBe("u=rwxs,g=rx,o=rx");
    for (const mode of [0o644, 0o1777, 0o2750, 0o4711, 0]) {
      expect(toNumberOf(applySymbolic(fromOctal(0o777), symbolicExpression(fromOctal(mode)))!)).toBe(mode);
    }
  });

  it("points out risky modes", () => {
    expect(risks(fromOctal(0o777))).toEqual(["world-writable"]);
    expect(risks(fromOctal(0o1777))).toEqual([]);
    expect(risks(fromOctal(0o4755))).toEqual(["setuid"]);
    expect(risks(fromOctal(0o044))).toEqual(["owner-less"]);
  });

  it("reads pasted commands and expressions", () => {
    const cmd = parseChmodInput("sudo chmod -R 750 /srv/app");
    expect(cmd.ok && [toOctal(cmd.perms), cmd.recursive, cmd.target, cmd.source]).toEqual([
      "750",
      true,
      "/srv/app",
      "mode",
    ]);
    const expr = parseChmodInput("u+x");
    expect(expr.ok && [toOctal(expr.perms), expr.source]).toEqual(["744", "expression"]);
    const plain = parseChmodInput("rw-r-----");
    expect(plain.ok && toOctal(plain.perms)).toBe("640");
    expect(parseChmodInput("chmod").ok).toBe(false);
    expect(parseChmodInput("755 extra").ok).toBe(false);
  });

  it("rejects invalid modes", () => {
    for (const bad of ["", "8", "75", "99999", "rwxr-xr", "rwzr-xr-x"]) expect(parseMode(bad).ok).toBe(false);
  });
});

describe(".env", () => {
  it("parses quotes, comments and export", () => {
    const { entries, issues } = parseEnv(
      [
        "# database",
        "export DB_HOST=localhost",
        "DB_PORT=5432 # default",
        "GREETING='hello # not a comment'",
        'MULTI="line1\\nline2"',
        "EMPTY=",
      ].join("\n"),
    );
    expect(issues).toEqual([]);
    expect(Object.fromEntries(entries.map((e) => [e.key, e.value]))).toEqual({
      DB_HOST: "localhost",
      DB_PORT: "5432",
      GREETING: "hello # not a comment",
      MULTI: "line1\nline2",
      EMPTY: "",
    });
  });

  it("supports values spanning several lines", () => {
    const { entries } = parseEnv('KEY="-----BEGIN-----\nabc\n-----END-----"\nNEXT=1');
    expect(entries.map((e) => e.key)).toEqual(["KEY", "NEXT"]);
    expect(entries[0].value).toBe("-----BEGIN-----\nabc\n-----END-----");
  });

  it("reports duplicates (last one wins) and broken quotes", () => {
    const { entries, issues } = parseEnv("A=1\nB=\"open\nA=2\nC=it's");
    expect(issues).toEqual(
      expect.arrayContaining([
        { code: "unterminated-quote", line: 2, key: "B" },
        { code: "stray-quote", line: 4, key: "C" },
      ]),
    );
    // The unterminated value keeps its line only, so the next lines are still read.
    expect(entries.find((e) => e.key === "A")?.value).toBe("2");
    expect(issues).toContainEqual({ code: "duplicate", line: 3, key: "A", first: 1 });
    const dup = parseEnv("A=1\nB=2\nA=3");
    expect(dup.issues).toEqual([{ code: "duplicate", line: 3, key: "A", first: 1 }]);
    expect(envToObject(dup)).toEqual({ B: "2", A: "3" });
  });

  it("reports invalid lines", () => {
    const { issues } = parseEnv("1BAD=x\nNOEQUALS\nKEY = value\nSPACED=a b");
    expect(issues.map((i) => i.code)).toEqual([
      "invalid-key",
      "missing-equals",
      "spaces-around-equals",
      "unquoted-spaces",
    ]);
  });

  it("converts to typed and nested JSON", () => {
    const parse = parseEnv("PORT=3000\nDEBUG=true\nDB__HOST=x\nDB__PORT=5432\nID=007");
    expect(envToObject(parse, { typed: true, nest: true })).toEqual({
      PORT: 3000,
      DEBUG: true,
      DB: { HOST: "x", PORT: 5432 },
      ID: "007",
    });
  });

  it("converts JSON to .env, quoting only when needed", () => {
    const r = jsonToEnv('{"port":3000,"name":"my app","db":{"host":"x"},"tags":["a"],"none":null,"q":"it\'s"}', {
      uppercase: true,
    });
    expect(r).toEqual({
      ok: true,
      flattened: 1,
      output: `PORT=3000\nNAME='my app'\nDB__HOST=x\nTAGS='["a"]'\nNONE=\nQ="it's"\n`,
    });
    expect(jsonToEnv("[1]")).toEqual({ ok: false, error: "not-object" });
    expect(jsonToEnv("{").ok).toBe(false);
    expect(envValue("a\nb")).toBe('"a\\nb"');
    expect(envValue("$HOME's")).toBe('"\\$HOME\'s"');
  });
});
