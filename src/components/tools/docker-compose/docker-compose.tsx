"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { ConverterTool } from "@/components/shared/converter-tool";
import { fail, ok } from "@/lib/utils/convert/result";
import { parseDockerRun, toCompose } from "@/lib/utils/infra/docker-compose";

const EXAMPLE = `docker run -d \\
  --name postgres \\
  -p 5432:5432 \\
  -e POSTGRES_USER=app \\
  -e POSTGRES_PASSWORD=change-me \\
  -v pgdata:/var/lib/postgresql/data \\
  --restart unless-stopped \\
  --health-cmd "pg_isready -U app" \\
  --health-interval 10s \\
  postgres:16-alpine

docker run -d --name adminer -p 8080:8080 --restart unless-stopped adminer`;

export default function DockerCompose() {
  const t = useTranslations("tools.docker-compose");

  const convert = useCallback(
    (input: string) => {
      const r = parseDockerRun(input);
      if (!r.ok) return fail(t(`errors.${r.error}`), r.line);
      const warnings = r.compose.ignored.length > 0 ? [t("ignored", { flags: r.compose.ignored.join(" ") })] : [];
      return ok(toCompose(r.compose), warnings);
    },
    [t],
  );

  return (
    <ConverterTool
      toolId="docker-compose"
      directions={[{ input: { label: "docker run" }, output: { label: "docker-compose.yml", language: "yaml" } }]}
      convert={convert}
      example={EXAMPLE}
      placeholder={t("placeholder")}
    />
  );
}
