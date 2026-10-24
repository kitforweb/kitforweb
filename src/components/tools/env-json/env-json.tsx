"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { ConverterTool } from "@/components/shared/converter-tool";
import { ToolbarSwitch } from "@/components/shared/toolbar-controls";
import { fail, ok } from "@/lib/utils/convert/result";
import { envToObject, jsonToEnv, parseEnv } from "@/lib/utils/infra/dotenv";

const ENV_EXAMPLE = `# App
NODE_ENV=production
PORT=3000
APP_NAME="Kit for Web"

# Database
DB__HOST=localhost
DB__PORT=5432
DB__PASSWORD='s3cr3t#!'
PORT=8080
API_URL = https://api.example.com
GREETING=Hello world`;

const JSON_EXAMPLE = `{
  "NODE_ENV": "production",
  "PORT": 3000,
  "FEATURE_FLAGS": ["search", "beta"],
  "db": { "host": "localhost", "password": "s3cr3t #1" }
}`;

export default function EnvJson() {
  const t = useTranslations("tools.env-json");
  const [typed, setTyped] = useState(false);
  const [nest, setNest] = useState(false);
  const [uppercase, setUppercase] = useState(true);

  const convert = useCallback(
    (input: string, direction: number) => {
      if (direction === 0) {
        const parse = parseEnv(input);
        const warnings = parse.issues.map((i) =>
          t(`issues.${i.code}`, { line: i.line, key: i.key ?? "", first: i.first ?? 0 }),
        );
        return ok(JSON.stringify(envToObject(parse, { typed, nest }), null, 2), warnings);
      }
      const r = jsonToEnv(input, { uppercase });
      if (!r.ok)
        return fail(r.error === "not-object" ? t("errors.not-object") : (r.message ?? t("errors.invalid-json")));
      return ok(r.output);
    },
    [t, typed, nest, uppercase],
  );

  return (
    <ConverterTool
      toolId="env-json"
      directions={[
        { input: { label: ".env" }, output: { label: "env.json", language: "json" } },
        { input: { label: "env.json", language: "json" }, output: { label: ".env" } },
      ]}
      convert={convert}
      example={(d) => (d === 0 ? ENV_EXAMPLE : JSON_EXAMPLE)}
      placeholder={t("placeholder")}
      fileAccept=".env,.json,text/plain"
      toolbar={(d) => (
        <>
          <span className="px-1 font-mono text-xs text-accent-text">{d === 0 ? ".env → JSON" : "JSON → .env"}</span>
          {d === 0 ? (
            <>
              <ToolbarSwitch label={t("typed")} checked={typed} onChange={setTyped} />
              <ToolbarSwitch label={t("nest")} checked={nest} onChange={setNest} />
            </>
          ) : (
            <ToolbarSwitch label={t("uppercase")} checked={uppercase} onChange={setUppercase} />
          )}
        </>
      )}
    />
  );
}
