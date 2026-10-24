"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { ConverterTool } from "@/components/shared/converter-tool";
import { Segmented } from "@/components/shared/toolbar-controls";
import { fail, ok } from "@/lib/utils/convert/result";
import { parseCurl, toAngular, toAxios, toFetch } from "@/lib/utils/http/curl";

type Target = "fetch" | "axios" | "angular";

const EXAMPLE = `curl 'https://api.example.com/v1/orders?status=paid' \\
  -H 'accept: application/json' \\
  -H 'authorization: Bearer eyJhbGciOiJIUzI1NiJ9.e30.demo' \\
  -H 'content-type: application/json' \\
  --data-raw '{"productId":42,"quantity":2,"coupon":null}' \\
  --compressed`;

const GENERATORS = { fetch: toFetch, axios: toAxios, angular: toAngular } as const;

export default function CurlToFetch() {
  const t = useTranslations("tools.curl-to-fetch");
  const [target, setTarget] = useState<Target>("fetch");

  const convert = useCallback(
    (input: string) => {
      const r = parseCurl(input);
      if (!r.ok) return fail(t(`errors.${r.error}`));
      const warnings = r.curl.warnings.map((w) => t(`warnings.${w}`));
      return ok(GENERATORS[target](r.curl), warnings);
    },
    [target, t],
  );

  return (
    <ConverterTool
      toolId="curl-to-fetch"
      directions={[
        {
          input: { label: "curl" },
          output: {
            label: target === "angular" ? "request.service.ts" : "request.js",
            language: target === "angular" ? "typescript" : "javascript",
          },
        },
      ]}
      convert={convert}
      example={EXAMPLE}
      placeholder={t("placeholder")}
      toolbar={
        <Segmented
          label={t("target")}
          value={target}
          onChange={setTarget}
          options={[
            { value: "fetch", label: "fetch" },
            { value: "axios", label: "axios" },
            { value: "angular", label: "Angular HttpClient" },
          ]}
        />
      }
    />
  );
}
