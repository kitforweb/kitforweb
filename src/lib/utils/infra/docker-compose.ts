import { tokenize } from "../shell/tokenize";

/** A value of the compose model: what the YAML emitter knows how to write. */
export type ComposeValue = string | number | boolean | ComposeValue[] | { [key: string]: ComposeValue };
type ComposeMap = { [key: string]: ComposeValue };

export interface ComposeService {
  name: string;
  service: ComposeMap;
}

export interface DockerRunParse {
  services: ComposeService[];
  volumes: string[];
  networks: string[];
  /** Flags that have no compose equivalent or were not recognised. */
  ignored: string[];
}

export type DockerRunResult =
  { ok: true; compose: DockerRunParse } | { ok: false; error: "not-docker-run" | "no-image" | "quotes"; line?: number };

/** Flags that take a value, with the compose key they map to (list-valued keys collect repeats). */
const VALUE_FLAGS: Record<string, string> = {
  "--name": "container_name",
  "-p": "ports",
  "--publish": "ports",
  "-e": "environment",
  "--env": "environment",
  "--env-file": "env_file",
  "-v": "volumes",
  "--volume": "volumes",
  "--mount": "volumes",
  "--network": "network",
  "--net": "network",
  "--network-alias": "aliases",
  "--restart": "restart",
  "-w": "working_dir",
  "--workdir": "working_dir",
  "-u": "user",
  "--user": "user",
  "--entrypoint": "entrypoint",
  "-h": "hostname",
  "--hostname": "hostname",
  "-l": "labels",
  "--label": "labels",
  "--add-host": "extra_hosts",
  "--dns": "dns",
  "--dns-search": "dns_search",
  "--cap-add": "cap_add",
  "--cap-drop": "cap_drop",
  "--device": "devices",
  "--tmpfs": "tmpfs",
  "-m": "mem_limit",
  "--memory": "mem_limit",
  "--memory-reservation": "mem_reservation",
  "--cpus": "cpus",
  "--cpu-shares": "cpu_shares",
  "--shm-size": "shm_size",
  "--platform": "platform",
  "--pull": "pull_policy",
  "--expose": "expose",
  "--log-driver": "log_driver",
  "--log-opt": "log_opt",
  "--health-cmd": "health_cmd",
  "--health-interval": "health_interval",
  "--health-timeout": "health_timeout",
  "--health-retries": "health_retries",
  "--health-start-period": "health_start_period",
  "--security-opt": "security_opt",
  "--sysctl": "sysctls",
  "--ulimit": "ulimits",
  "--stop-signal": "stop_signal",
  "--stop-timeout": "stop_grace_period",
  "--pid": "pid",
  "--ipc": "ipc",
  "--gpus": "gpus",
};

/** Boolean flags and the compose key they set to true (null: no compose equivalent). */
const BOOL_FLAGS: Record<string, string | null> = {
  "-d": null,
  "--detach": null,
  "--rm": null,
  "-i": "stdin_open",
  "--interactive": "stdin_open",
  "-t": "tty",
  "--tty": "tty",
  "--privileged": "privileged",
  "--read-only": "read_only",
  "--init": "init",
  "-P": null,
  "--publish-all": null,
  "--no-healthcheck": "no_healthcheck",
};

/** Splits the text into commands: one per line once continuations are joined, or separated by && / ;. */
function splitCommands(text: string): { command: string; line: number }[] {
  const out: { command: string; line: number }[] = [];
  const lines = text.split(/\r?\n/);
  let current = "";
  let start = 0;
  lines.forEach((raw, i) => {
    if (current === "") start = i + 1;
    const continued = /[\\^`]\s*$/.test(raw);
    current += (current ? " " : "") + (continued ? raw.replace(/[\\^`]\s*$/, "") : raw);
    if (!continued) {
      for (const part of current.split(/\s(?:&&|;)\s/))
        if (part.trim()) out.push({ command: part.trim(), line: start });
      current = "";
    }
  });
  if (current.trim()) out.push({ command: current.trim(), line: start });
  return out;
}

const isDockerRun = (tokens: string[]) => {
  let i = tokens[0] === "sudo" ? 1 : 0;
  if (tokens[i] !== "docker") return -1;
  i++;
  if (tokens[i] === "container") i++;
  return tokens[i] === "run" ? i + 1 : -1;
};

/** "--mount type=bind,source=./data,target=/data,readonly" → long volume syntax. */
function parseMount(spec: string): ComposeValue {
  const out: ComposeMap = {};
  for (const part of spec.split(",")) {
    const [k, v = "true"] = part.split("=");
    const key = k.trim();
    if (key === "src" || key === "source") out.source = v;
    else if (key === "dst" || key === "destination" || key === "target") out.target = v;
    else if (key === "type") out.type = v;
    else if (key === "readonly" || key === "ro") out.read_only = v !== "false";
  }
  return out;
}

function serviceName(image: string, containerName: string | undefined, taken: Set<string>): string {
  const base = (containerName ?? image.split("/").pop()!.split(/[:@]/)[0])
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  let name = base || "app";
  for (let n = 2; taken.has(name); n++) name = `${base}-${n}`;
  taken.add(name);
  return name;
}

function parseOne(tokens: string[], startAt: number, taken: Set<string>, parse: DockerRunParse) {
  const raw: Record<string, string[]> = {};
  const flags: Record<string, true> = {};
  let i = startAt;
  let image: string | undefined;

  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok === "--") {
      i++;
      continue;
    }
    if (!tok.startsWith("-") || tok === "-") {
      image = tok;
      i++;
      break;
    }
    let flag = tok;
    let value: string | undefined;
    const eq = tok.indexOf("=");
    if (tok.startsWith("--") && eq > 0) {
      flag = tok.slice(0, eq);
      value = tok.slice(eq + 1);
    }
    if (flag in VALUE_FLAGS) {
      if (value === undefined) value = tokens[++i] ?? "";
      (raw[VALUE_FLAGS[flag]] ??= []).push(value);
    } else if (flag in BOOL_FLAGS) {
      const key = BOOL_FLAGS[flag];
      if (key) flags[key] = true;
    } else if (/^-[a-zA-Z]./.test(flag)) {
      // Grouped short flags (-dit) or a short flag with its value attached (-p8080:80).
      const letters = flag.slice(1);
      const valueFlag = `-${letters[0]}`;
      if (valueFlag in VALUE_FLAGS && !(valueFlag in BOOL_FLAGS)) {
        (raw[VALUE_FLAGS[valueFlag]] ??= []).push(letters.slice(1));
      } else {
        for (const l of letters) {
          const f = `-${l}`;
          if (f in BOOL_FLAGS) {
            const key = BOOL_FLAGS[f];
            if (key) flags[key] = true;
          } else if (f in VALUE_FLAGS) {
            (raw[VALUE_FLAGS[f]] ??= []).push(tokens[++i] ?? "");
          } else parse.ignored.push(f);
        }
      }
    } else {
      parse.ignored.push(flag);
      // Unknown "--flag value": skip the value when it does not look like a flag or the image.
      if (value === undefined && tokens[i + 1] && !tokens[i + 1].startsWith("-") && tokens[i + 2] !== undefined) i++;
    }
    i++;
  }
  if (!image) return false;

  const command = tokens.slice(i);
  const one = (k: string) => raw[k]?.[raw[k].length - 1];
  const svc: ComposeMap = { image };
  const container = one("container_name");
  if (container) svc.container_name = container;

  const network = one("network");
  if (network && ["host", "none", "bridge"].includes(network)) svc.network_mode = network;
  else if (network?.startsWith("container:")) svc.network_mode = network;

  const keys = [
    "hostname",
    "restart",
    "user",
    "working_dir",
    "platform",
    "pull_policy",
    "pid",
    "ipc",
    "stop_signal",
    "stop_grace_period",
    "shm_size",
    "mem_limit",
    "mem_reservation",
    "cpus",
    "cpu_shares",
  ];
  for (const k of keys) {
    const v = one(k);
    if (v === undefined) continue;
    if (k === "stop_grace_period") svc[k] = /^\d+$/.test(v) ? `${v}s` : v;
    else if (k === "cpus") svc[k] = Number.isFinite(Number(v)) ? Number(v) : v;
    else if (k === "cpu_shares") svc[k] = Number.isFinite(Number(v)) ? Number(v) : v;
    else svc[k] = v;
  }

  const entrypoint = one("entrypoint");
  if (entrypoint !== undefined) svc.entrypoint = entrypoint;
  if (command.length > 0) svc.command = command.length === 1 && !/\s/.test(command[0]) ? command[0] : command;

  for (const k of [
    "ports",
    "expose",
    "env_file",
    "extra_hosts",
    "dns",
    "dns_search",
    "cap_add",
    "cap_drop",
    "devices",
    "tmpfs",
    "security_opt",
  ]) {
    if (raw[k]) svc[k] = raw[k];
  }

  if (raw.environment) {
    const pairs = raw.environment.map((e) => {
      const at = e.indexOf("=");
      return at < 0 ? ([e, undefined] as const) : ([e.slice(0, at), e.slice(at + 1)] as const);
    });
    svc.environment = pairs.every(([, v]) => v !== undefined)
      ? Object.fromEntries(pairs.map(([k, v]) => [k, v!]))
      : raw.environment;
  }

  if (raw.labels) {
    svc.labels = Object.fromEntries(
      raw.labels.map((l) => {
        const at = l.indexOf("=");
        return at < 0 ? [l, ""] : [l.slice(0, at), l.slice(at + 1)];
      }),
    );
  }

  if (raw.sysctls) {
    svc.sysctls = Object.fromEntries(raw.sysctls.map((l) => [l.split("=")[0], l.slice(l.indexOf("=") + 1)]));
  }

  if (raw.ulimits) {
    const ulimits: ComposeMap = {};
    for (const u of raw.ulimits) {
      const [name, limits = ""] = u.split("=");
      const [soft, hard] = limits.split(":").map(Number);
      ulimits[name] = hard !== undefined && Number.isFinite(hard) ? { soft, hard } : soft;
    }
    svc.ulimits = ulimits;
  }

  if (raw.volumes) {
    svc.volumes = raw.volumes.map((v) => {
      // --mount values are distinguishable by their key=value syntax.
      if (/^(type|source|src|target|dst|destination)=/.test(v) || /,(type|target|dst)=/.test(v)) {
        const m = parseMount(v) as ComposeMap;
        if (m.type === "volume" && typeof m.source === "string" && !parse.volumes.includes(m.source))
          parse.volumes.push(m.source);
        return m;
      }
      const source = v.split(":")[0];
      // A named volume is a source without a path: "data:/var/lib/data".
      if (v.includes(":") && /^[A-Za-z0-9][\w.-]*$/.test(source) && !parse.volumes.includes(source))
        parse.volumes.push(source);
      return v;
    });
  }

  if (flags.stdin_open) svc.stdin_open = true;
  if (flags.tty) svc.tty = true;
  if (flags.privileged) svc.privileged = true;
  if (flags.read_only) svc.read_only = true;
  if (flags.init) svc.init = true;

  const health: ComposeMap = {};
  const healthCmd = one("health_cmd");
  if (healthCmd) health.test = ["CMD-SHELL", healthCmd];
  for (const [k, target] of [
    ["health_interval", "interval"],
    ["health_timeout", "timeout"],
    ["health_start_period", "start_period"],
  ] as const) {
    const v = one(k);
    if (v) health[target] = v;
  }
  const retries = one("health_retries");
  if (retries) health.retries = Number(retries);
  if (flags.no_healthcheck) health.disable = true;
  if (Object.keys(health).length > 0) svc.healthcheck = health;

  const logDriver = one("log_driver");
  if (logDriver || raw.log_opt) {
    const logging: ComposeMap = {};
    if (logDriver) logging.driver = logDriver;
    if (raw.log_opt)
      logging.options = Object.fromEntries(raw.log_opt.map((o) => [o.split("=")[0], o.slice(o.indexOf("=") + 1)]));
    svc.logging = logging;
  }

  const gpus = one("gpus");
  if (gpus) {
    const count: ComposeValue = gpus === "all" ? "all" : Number.isFinite(Number(gpus)) ? Number(gpus) : gpus;
    svc.deploy = { resources: { reservations: { devices: [{ driver: "nvidia", count, capabilities: ["gpu"] }] } } };
  }

  if (network && !svc.network_mode) {
    if (!parse.networks.includes(network)) parse.networks.push(network);
    svc.networks = raw.aliases ? { [network]: { aliases: raw.aliases } } : [network];
  }

  parse.services.push({ name: serviceName(image, container, taken), service: svc });
  return true;
}

/** Parses one or more `docker run` commands into compose services. */
export function parseDockerRun(text: string): DockerRunResult {
  const commands = splitCommands(text);
  if (commands.length === 0) return { ok: false, error: "not-docker-run" };
  const parse: DockerRunParse = { services: [], volumes: [], networks: [], ignored: [] };
  const taken = new Set<string>();
  for (const { command, line } of commands) {
    if (command.startsWith("#")) continue;
    const tokens = tokenize(command);
    if (!tokens) return { ok: false, error: "quotes", line };
    const start = isDockerRun(tokens);
    if (start < 0) return { ok: false, error: "not-docker-run", line };
    if (!parseOne(tokens, start, taken, parse)) return { ok: false, error: "no-image", line };
  }
  if (parse.services.length === 0) return { ok: false, error: "not-docker-run" };
  parse.ignored = [...new Set(parse.ignored)];
  return { ok: true, compose: parse };
}

// ---------------------------------------------------------------------------
// YAML emitter: compose files only need maps, lists and scalars, and writing
// them by hand lets us quote the values compose users expect quoted ("80:80").

const PLAIN = /^[\w./~$][\w./@:=+~$-]*$/;
const AMBIGUOUS = /^(true|false|yes|no|on|off|null|~|y|n)$/i;
// Numbers, and digit/colon strings that YAML 1.1 reads as base-60 ("80:80").
const NUMERIC = /^[-+]?(0[xob][\da-f_]+|[\d._:]+([eE][-+]?\d+)?)$/i;

export function yamlScalar(value: string | number | boolean): string {
  if (typeof value !== "string") return String(value);
  if (PLAIN.test(value) && !value.endsWith(":") && !AMBIGUOUS.test(value) && !NUMERIC.test(value)) return value;
  return JSON.stringify(value);
}

const yamlKey = (k: string) => (/^[A-Za-z_][\w.-]*$/.test(k) ? k : JSON.stringify(k));

function emit(value: ComposeValue, indent: number, lines: string[], prefix: string) {
  const pad = " ".repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) {
      lines.push(`${prefix} []`);
      return;
    }
    lines.push(prefix);
    for (const item of value) {
      if (item !== null && typeof item === "object" && !Array.isArray(item)) {
        const entries = Object.entries(item);
        entries.forEach(([k, v], idx) => {
          const lead = idx === 0 ? `${pad}- ` : `${pad}  `;
          if (v !== null && typeof v === "object") emit(v, indent + 4, lines, `${lead}${yamlKey(k)}:`);
          else lines.push(`${lead}${yamlKey(k)}: ${yamlScalar(v)}`);
        });
      } else if (Array.isArray(item)) {
        lines.push(`${pad}- ${JSON.stringify(item)}`);
      } else lines.push(`${pad}- ${yamlScalar(item)}`);
    }
    return;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      lines.push(`${prefix} {}`);
      return;
    }
    if (prefix) lines.push(prefix);
    for (const [k, v] of entries) {
      if (v !== null && typeof v === "object") emit(v, indent + 2, lines, `${pad}${yamlKey(k)}:`);
      else lines.push(`${pad}${yamlKey(k)}: ${yamlScalar(v)}`);
    }
    return;
  }
  lines.push(`${prefix} ${yamlScalar(value)}`);
}

/** Writes a value as block YAML (indentation of 2 spaces). */
export function toYaml(value: ComposeMap): string {
  const lines: string[] = [];
  emit(value, 0, lines, "");
  return lines.join("\n") + "\n";
}

/** The docker-compose.yml text for parsed `docker run` commands. */
export function toCompose(parse: DockerRunParse): string {
  const doc: ComposeMap = { services: Object.fromEntries(parse.services.map((s) => [s.name, s.service])) };
  if (parse.volumes.length > 0) doc.volumes = Object.fromEntries(parse.volumes.map((v) => [v, {}]));
  if (parse.networks.length > 0) doc.networks = Object.fromEntries(parse.networks.map((n) => [n, { external: true }]));
  return toYaml(doc);
}
