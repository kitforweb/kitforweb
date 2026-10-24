import { expect, test } from "@playwright/test";
import { loadExample, openTool, typeInEditor } from "./helpers";

test.describe("3.12 Live editors", () => {
  test("Playground renders in a sandbox and captures the console", async ({ page }) => {
    await openTool(page, "/en/html-css-js-playground");
    await loadExample(page);
    const iframe = page.getByTestId("playground-frame");
    await expect(iframe).toHaveAttribute("sandbox", "allow-scripts");
    const frame = page.frameLocator('[data-testid="playground-frame"]');
    await expect(frame.locator("h1")).toHaveText("Hello, playground");

    const consoleList = page.getByTestId("playground-console");
    await expect(consoleList).toContainText("Ready { items: 3 }");
    await frame.locator("#counter").click();
    await expect(frame.locator("#counter")).toHaveText("Clicked 1 times");
    await expect(consoleList).toContainText("Clicked 1");
  });

  test("Playground reports runtime errors and cannot reach the parent page", async ({ page }) => {
    await openTool(page, "/es/playground-html-css-js");
    await page.getByRole("tab", { name: "JS" }).click();
    await typeInEditor(
      page,
      page.getByRole("tabpanel").locator(".cm-content"),
      'try { console.log(parent.document.title) } catch (e) { console.warn("blocked", e.name) }\nthrow new Error("boom")',
    );
    const consoleList = page.getByTestId("playground-console");
    await expect(consoleList.locator('li[data-level="warn"]')).toContainText("blocked SecurityError");
    await expect(consoleList.locator('li[data-level="error"]')).toContainText("Error: boom");
  });
});
