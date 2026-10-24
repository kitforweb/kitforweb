import { expect, test } from "@playwright/test";
import { converterOutput, loadExample, openTool } from "./helpers";

test.describe("3.9 Text and code", () => {
  test("Markdown renders GFM, highlighted code and a Mermaid diagram", async ({ page }) => {
    await openTool(page, "/en/markdown-editor");
    await loadExample(page);
    const preview = page.getByTestId("md-preview");
    await expect(preview.locator("h1")).toHaveText("kitforweb");
    await expect(preview.locator("table td").first()).toHaveText("JSON Formatter");
    await expect(preview.locator('input[type="checkbox"]')).toHaveCount(3);
    await expect(preview.locator("pre code.hljs .hljs-keyword").first()).toBeVisible();
    await expect(page.getByTestId("md-mermaid").locator("svg")).toBeVisible({ timeout: 15_000 });
  });

  test("HTML → JSX renames attributes and wraps a component", async ({ page }) => {
    await openTool(page, "/en/html-to-jsx");
    await loadExample(page);
    const out = converterOutput(page);
    await expect(out).toContainText("export default function SignupCard() {");
    await expect(out).toContainText('<label htmlFor="email">Email</label>');
    await expect(out).toContainText('style={{ maxWidth: "420px", marginTop: "2rem", zIndex: 2 }}');
    await expect(out).toContainText('<input type="checkbox" defaultChecked />');
    await expect(out).toContainText('strokeWidth="2"');
  });

  test("Case converter shows every style", async ({ page }) => {
    await openTool(page, "/es/convertir-mayusculas-camelcase");
    await loadExample(page);
    await expect(page.getByTestId("case-camel")).toContainText("userFirstName");
    await expect(page.getByTestId("case-camel")).toContainText("getHttpResponseCode");
    await expect(page.getByTestId("case-snake")).toContainText("max_retry_count");
    await expect(page.getByTestId("case-kebab")).toContainText("order-line-item");
  });

  test("Text diff highlights the changed lines and words", async ({ page }) => {
    await openTool(page, "/en/text-diff");
    await loadExample(page);
    await expect(page.getByTestId("diff-summary")).toContainText("+3");
    await expect(page.getByTestId("diff-summary")).toContainText("−3");
    const table = page.getByTestId("diff-table");
    await expect(table.locator('tr[data-kind="replace"]')).toHaveCount(3);
    await expect(table).toContainText("sum += item.price * item.quantity;");
    await page.getByRole("radio", { name: "Inline" }).click();
    await expect(table.locator('tr[data-kind="del"]')).toHaveCount(3);
  });

  test("Keyboard tester shows key, code and keyCode", async ({ page }) => {
    await openTool(page, "/en/keyboard-event-tester");
    await page.getByTestId("key-capture").focus();
    await page.keyboard.press("Shift+KeyA");
    await expect(page.getByTestId("key-combo")).toHaveText("Shift+A");
    await expect(page.getByTestId("key-code")).toContainText('"KeyA"');
    await expect(page.getByTestId("key-keycode")).toContainText("65");
    await loadExample(page);
    await expect(page.getByTestId("key-combo")).toHaveText("Ctrl+Shift+K");
    await expect(page.getByTestId("key-snippet")).toContainText(
      'event.key.toLowerCase() === "k" && event.ctrlKey && event.shiftKey',
    );
  });
});
