"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { ConverterTool } from "@/components/shared/converter-tool";
import { ToolbarField, ToolbarSwitch } from "@/components/shared/toolbar-controls";
import { fail, ok } from "@/lib/utils/convert/result";
import { htmlToJsx } from "@/lib/utils/text/html-to-jsx";

const EXAMPLE = `<!-- Signup card -->
<div class="card" style="max-width: 420px; margin-top: 2rem; z-index: 2">
  <h2 class="card-title">Create your account</h2>
  <form action="/signup" method="post" novalidate>
    <label for="email">Email</label>
    <input id="email" type="email" class="input" placeholder="you@example.com" autocomplete="email" required>
    <label><input type="checkbox" checked> Send me the newsletter</label>
    <button type="submit" class="btn btn-primary" onclick="track('signup')">Sign up</button>
  </form>
  <svg viewBox="0 0 24 24" stroke-width="2" fill-rule="evenodd"><path d="M5 12h14"/></svg>
  <p>Already have one? <a href="/login" tabindex="0">Log in</a> &rarr;</p>
</div>`;

const isIdentifier = (name: string) => /^[A-Z][A-Za-z0-9]*$/.test(name);

export default function HtmlToJsx() {
  const t = useTranslations("tools.html-to-jsx");
  const [wrap, setWrap] = useState(true);
  const [name, setName] = useState("SignupCard");
  const [uncontrolled, setUncontrolled] = useState(true);

  const convert = useCallback(
    (input: string) => {
      const r = htmlToJsx(input, { component: wrap && isIdentifier(name) ? name : undefined, uncontrolled });
      if (!r.ok) return fail(t(`errors.${r.error}`));
      return ok(
        r.output,
        r.warnings.map((w) => t(`warnings.${w}`)),
      );
    },
    [t, wrap, name, uncontrolled],
  );

  return (
    <ConverterTool
      toolId="html-to-jsx"
      directions={[
        {
          input: { label: "index.html", language: "html" },
          output: { label: `${name || "Component"}.jsx`, language: "jsx" },
        },
      ]}
      convert={convert}
      example={EXAMPLE}
      placeholder={t("placeholder")}
      fileAccept=".html,.htm,.svg,text/html"
      toolbar={
        <>
          <ToolbarSwitch label={t("wrap")} checked={wrap} onChange={setWrap} />
          {wrap && <ToolbarField label={t("name")} value={name} onChange={setName} width="w-32" />}
          <ToolbarSwitch label={t("uncontrolled")} checked={uncontrolled} onChange={setUncontrolled} />
        </>
      }
    />
  );
}
