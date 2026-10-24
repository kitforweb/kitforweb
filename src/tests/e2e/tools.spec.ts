import { expect, test, type Page } from "@playwright/test";

const editorText = (page: Page, panel: string) =>
  page.getByRole("region", { name: panel }).locator(".cm-content").first();

test.describe("JSON formatter", () => {
  test("formats the example and marks every error", async ({ page }) => {
    await page.goto("/en/json-formatter");
    await page.getByRole("button", { name: "Example" }).click();
    await expect(page.getByText("Valid JSON")).toBeVisible();
    await expect(editorText(page, "output.json")).toContainText('"name": "kitforweb"');

    const input = editorText(page, "input.json");
    await input.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.insertText('{"a": 1 "b": 2,}');
    await expect(page.getByText(/2 errors found/)).toBeVisible();
    await expect(page.getByText("A comma is missing between these elements.")).toBeVisible();
    await expect(page.locator(".cm-lintRange-error").first()).toBeVisible();
  });

  test("minifies", async ({ page }) => {
    await page.goto("/en/json-formatter");
    await page.getByRole("button", { name: "Example" }).click();
    await page.getByRole("radio", { name: "Minify" }).click();
    await expect(editorText(page, "output.min.json")).toContainText('{"name":"kitforweb","version":"1.0.0"');
  });
});

test.describe("JWT decoder", () => {
  test("decodes, shows expiry and verifies the signature (es)", async ({ page }) => {
    await page.goto("/es/decodificador-jwt");
    await page.getByRole("button", { name: "Ejemplo" }).click();
    await expect(page.getByText('"name": "Ada Lovelace"')).toBeVisible();
    await expect(page.getByText(/Válido · caduca/)).toBeVisible();

    await page.getByLabel(/Secreto/).fill("kitforweb-secret");
    await expect(page.getByText("Firma verificada")).toBeVisible();
    await page.getByLabel(/Secreto/).fill("wrong");
    await expect(page.getByText("La firma no es válida para esta clave")).toBeVisible();
  });

  test("never persists the token", async ({ page }) => {
    await page.goto("/en/jwt-decoder");
    await page.getByRole("button", { name: "Example" }).click();
    await page.waitForTimeout(500);
    const stored = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes("jwt")));
    expect(stored).toEqual([]);
  });
});

test.describe("clamp() generator", () => {
  test("builds a fluid clamp() and shares it through the hash", async ({ page }) => {
    await page.goto("/en/css-clamp-generator");
    const output = page.getByTestId("clamp-output");
    await expect(output).toContainText("clamp(1rem, ");
    await page.getByLabel("Maximum size").fill("32");
    await expect(output).toContainText("2rem)");

    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "Share" }).click();
    await expect(page).toHaveURL(/#.+/);
    await page.reload();
    await expect(page.getByLabel("Maximum size")).toHaveValue("32");
  });
});

test.describe("Mermaid editor", () => {
  test("renders the default diagram and reports syntax errors", async ({ page }) => {
    await page.goto("/en/mermaid-editor");
    await expect(page.getByTestId("mermaid-preview").locator("svg")).toBeVisible({ timeout: 15_000 });

    const input = editorText(page, "diagram.mmd");
    await input.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.insertText("flowchart LR\n  A --> ");
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10_000 });
  });
});
