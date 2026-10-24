import { UAParser } from "ua-parser-js";

export interface UserAgentInfo {
  browser: { name?: string; version?: string; major?: string };
  engine: { name?: string; version?: string };
  os: { name?: string; version?: string };
  device: {
    type: "desktop" | "mobile" | "tablet" | "smarttv" | "console" | "wearable" | "embedded" | "xr";
    vendor?: string;
    model?: string;
  };
  cpu?: string;
  bot?: string;
}

const BOTS: [RegExp, string][] = [
  [/Googlebot/i, "Googlebot"],
  [/bingbot/i, "Bingbot"],
  [/GPTBot/i, "GPTBot (OpenAI)"],
  [/ChatGPT-User/i, "ChatGPT-User (OpenAI)"],
  [/ClaudeBot|Claude-User|Claude-Web/i, "ClaudeBot (Anthropic)"],
  [/PerplexityBot/i, "PerplexityBot"],
  [/facebookexternalhit|meta-externalagent/i, "Meta"],
  [/Twitterbot/i, "Twitterbot"],
  [/LinkedInBot/i, "LinkedInBot"],
  [/Slackbot/i, "Slackbot"],
  [/WhatsApp/i, "WhatsApp"],
  [/DuckDuckBot/i, "DuckDuckBot"],
  [/YandexBot/i, "YandexBot"],
  [/Baiduspider/i, "Baiduspider"],
  [/AhrefsBot/i, "AhrefsBot"],
  [/curl\//i, "curl"],
  [/python-requests|aiohttp/i, "Python"],
  [/PostmanRuntime/i, "Postman"],
  [/HeadlessChrome/i, "Headless Chrome"],
  [/\b(bot|crawler|spider|crawl)\b/i, "Bot"],
];

/** Breaks a User-Agent string into browser, engine, OS and device, and recognises bots. */
export function parseUserAgent(ua: string): UserAgentInfo {
  const r = new UAParser(ua.trim()).getResult();
  const bot = BOTS.find(([re]) => re.test(ua))?.[1];
  const type = (r.device.type as UserAgentInfo["device"]["type"] | undefined) ?? "desktop";
  return {
    browser: { name: r.browser.name, version: r.browser.version, major: r.browser.major },
    engine: { name: r.engine.name, version: r.engine.version },
    os: { name: r.os.name, version: r.os.version },
    device: { type, vendor: r.device.vendor, model: r.device.model },
    cpu: r.cpu.architecture,
    ...(bot ? { bot } : {}),
  };
}
