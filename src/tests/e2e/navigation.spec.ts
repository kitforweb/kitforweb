import { expect, test } from "@playwright/test";

const JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkYSBMb3ZlbGFjZSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTczNTY4OTYwMCwiZXhwIjo0MTAyNDQ0ODAwfQ.S-HTpGBysyhDx_Vwg45FNhQKJERrf5C_y_yL-pkwk3I";

test("/ redirects by Accept-Language, and only there", async ({ request }) => {
  const es = await request.get("/", { headers: { "accept-language": "es-ES,es;q=0.9,en;q=0.8" }, maxRedirects: 0 });
  expect(es.status()).toBe(307);
  expect(es.headers()["location"]).toMatch(/\/es$/);

  const fallback = await request.get("/", { headers: { "accept-language": "de-DE" }, maxRedirects: 0 });
  expect(fallback.headers()["location"]).toMatch(/\/en$/);

  const internal = await request.get("/fr/formater-json", { headers: { "accept-language": "es" }, maxRedirects: 0 });
  expect(internal.status()).toBe(200);
});

test("switches language to the equivalent page", async ({ page }) => {
  await page.goto("/en/json-formatter");
  await page.getByRole("button", { name: "Language" }).click();
  await page.getByRole("link", { name: /Español/ }).click();
  await expect(page).toHaveURL(/\/es\/formatear-json$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Formatear y validar JSON");
});

test("explorer search filters tools", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("searchbox", { name: "Search tools…" }).fill("token");
  const explorer = page.getByRole("complementary");
  await expect(explorer.getByRole("link", { name: "JWT Decoder" })).toBeVisible();
  await expect(explorer.getByRole("link", { name: "Mermaid Editor" })).toHaveCount(0);
});

test("Ctrl+K opens the palette and jumps to a tool", async ({ page }) => {
  await page.goto("/en");
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Search a tool or paste anything…").fill("mermaid");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/en\/mermaid-editor$/);
  // The visited tool shows up as a tab.
  await expect(
    page.getByRole("navigation", { name: "Open tools" }).getByRole("link", { name: "Mermaid Editor" }),
  ).toBeVisible();
});

test("the smart detector opens the right tool with the content, not via the URL", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("textbox", { name: "Paste anything" }).fill(JWT);
  await expect(page.getByText("Looks like JWT:")).toBeVisible();
  await page.getByRole("button", { name: "JWT Decoder", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/jwt-decoder$/);
  expect(page.url()).not.toContain("eyJ");
  await expect(page.getByText('"name": "Ada Lovelace"')).toBeVisible();
});

test("tool pages ship SEO content and metadata in the server HTML", async ({ request }) => {
  const html = await (await request.get("/es/formatear-json")).text();
  expect(html).toContain('<link rel="canonical" href="https://kitforweb.com/es/formatear-json"');
  expect(html).toContain('hrefLang="x-default" href="https://kitforweb.com/en/json-formatter"');
  expect(html).toContain('hrefLang="pt-BR" href="https://kitforweb.com/pt/formatar-json"');
  expect(html).toContain("Errores de JSON más comunes");
  expect(html).toContain('"@type":"FAQPage"');
  expect(html).toContain('"@type":"WebApplication"');
});

test("sitemap, robots and llms.txt", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("https://kitforweb.com/fr/decodeur-jwt");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("User-Agent: ClaudeBot");
  expect(robots).toContain("Sitemap: https://kitforweb.com/sitemap.xml");
  const llms = await (await request.get("/llms.txt")).text();
  expect(llms).toContain("# kitforweb");
  expect(llms).toContain("[JSON Formatter](https://kitforweb.com/en/json-formatter)");
});
