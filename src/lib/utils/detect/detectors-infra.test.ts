import { describe, expect, it } from "vitest";
import { detectAll, detectChmod, detectCidr, detectDockerRun, detectEnv } from "./detectors";
import { resolveDetections } from "./resolve";

const TOOLS: Record<string, string> = {
  "docker-run": "docker-compose",
  cidr: "cidr",
  chmod: "chmod",
  env: "env-json",
  "http-status": "http-status",
  semver: "semver",
  radix: "number-base",
  timestamp: "timestamp",
};
const resolve = (input: string) => resolveDetections(input, (k) => TOOLS[k]);

describe("detectCidr", () => {
  it.each(["10.0.0.0/16", "192.168.1.10", "2001:db8::/32", "fe80::1", "0.0.0.0/0"])("detects %s", (input) => {
    expect(detectCidr(input)?.kind).toBe("cidr");
  });

  it("opens the CIDR tool automatically for blocks and addresses", () => {
    expect(resolve("172.16.0.0/12").auto?.toolId).toBe("cidr");
    expect(resolve("2001:db8::1").auto?.toolId).toBe("cidr");
  });

  it.each(["10.0.0.0/33", "300.1.1.1", "1.2.3", "v1.2.3.4", "abc", "/24", "::/129"])("ignores %s", (input) => {
    expect(detectCidr(input)).toBeNull();
  });
});

describe("detectChmod", () => {
  it.each(["chmod 755 deploy.sh", "chmod -R u+x bin", "-rw-r--r--", "rwxr-xr-x", "drwxrwsr-x.", "-rwsr-xr-x"])(
    "detects %s",
    (input) => {
      expect(detectChmod(input)?.confidence).toBeGreaterThan(0.9);
    },
  );

  it("treats a bare octal mode as a weak guess", () => {
    expect(detectChmod("644")?.confidence).toBeLessThan(0.5);
    // 400 is also an HTTP status: both are offered, none is opened.
    const r = resolve("400");
    expect(r.auto).toBeNull();
    expect(r.candidates.map((c) => c.toolId)).toEqual(expect.arrayContaining(["chmod", "http-status"]));
  });

  it.each(["chmod", "rwxr-xr", "999", "rwxrwxrwxx", "chmod me"])("ignores %s", (input) => {
    expect(detectChmod(input)).toBeNull();
  });
});

describe("docker run and .env", () => {
  it("detects docker run variants", () => {
    expect(detectDockerRun("sudo docker container run -d nginx")?.kind).toBe("docker-run");
    expect(resolve("docker run -p 80:80 nginx").auto?.toolId).toBe("docker-compose");
    expect(detectDockerRun("docker ps")).toBeNull();
  });

  it("detects .env files", () => {
    expect(resolve("# app\nPORT=3000\nexport DB_URL=postgres://x").auto?.toolId).toBe("env-json");
    expect(detectEnv("just some text")).toBeNull();
  });

  it("does not take versions or timestamps for addresses", () => {
    expect(detectAll("1.2.3").map((d) => d.kind)).not.toContain("cidr");
    expect(detectAll("1700000000").map((d) => d.kind)).not.toContain("cidr");
  });
});
