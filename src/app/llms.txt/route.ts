import { site } from "@/config/site";
import { tools } from "@/config/tools";
import { toolMessages } from "@/i18n/messages";
import messages from "@/i18n/messages/en.json";
import { aboutPath, homePath, toolPath } from "@/lib/routes";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-static";

/** https://llmstxt.org — a summary of the site for AI assistants. */
export function GET() {
  const toolLines = tools.map((tool) => {
    const m = toolMessages(tool.id, "en");
    return `- [${m.name}](${absoluteUrl(toolPath(tool.id, "en"))}): ${m.description}`;
  });

  const body = [
    `# ${site.name}`,
    "",
    `> ${messages.meta.description}`,
    "",
    "Every tool runs 100% in the browser: nothing the user pastes is sent to any server, so it is safe to use with tokens, certificates or production data. Available in English, Spanish (/es), French (/fr) and Brazilian Portuguese (/pt).",
    "",
    "## Tools",
    "",
    ...toolLines,
    "",
    "## About",
    "",
    `- [Home](${absoluteUrl(homePath("en"))})`,
    `- [About the author](${absoluteUrl(aboutPath("en"))})`,
    `- [Source code](${site.repository})`,
    "",
  ].join("\n");

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
