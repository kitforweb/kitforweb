import { expect, test, type Page } from "@playwright/test";
import { loadExample, openTool } from "./helpers";

async function drag(page: Page, from: string, to: string) {
  const source = page.locator(from);
  const target = page.locator(to);
  const a = await source.boundingBox();
  const b = await target.boundingBox();
  if (!a || !b) throw new Error("drag targets not visible");
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  // dnd-kit's pointer sensor needs real movement past its activation distance.
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 5 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height - 8, { steps: 15 });
  await page.mouse.up();
}

test.describe("3.4 Regex", () => {
  test("Builder: tap and drag blocks, edit, undo and test", async ({ page }) => {
    await openTool(page, "/en/regex-builder");
    const output = page.getByTestId("regex-output");
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(output).toHaveText("//");

    // Tap appends at the end.
    await page.getByRole("button", { name: "Add block: Digit" }).click();
    await expect(output).toHaveText("/\\d/");

    // Change how many times it repeats.
    await page.getByRole("radio", { name: "1+" }).click();
    await expect(output).toHaveText("/\\d+/");

    // Drag "Starts with" from the palette onto the canvas.
    await drag(page, 'button[aria-label="Add block: Ends here"]', '[data-testid="regex-canvas"]');
    await expect(output).toHaveText("/\\d+$/");

    // dnd-kit swallows the click that follows a drop for a moment: undo with the shortcut.
    await page.keyboard.press("ControlOrMeta+z");
    await expect(output).toHaveText("/\\d+/");
    await page.getByRole("button", { name: "Redo" }).click();
    await expect(output).toHaveText("/\\d+$/");
  });

  test("Builder: example converts a regex to blocks and exports it", async ({ page }) => {
    await openTool(page, "/es/constructor-regex");
    await loadExample(page);
    await expect(page.getByTestId("regex-output")).toHaveText("/^[\\w.+-]+@[\\w-]+\\.(?:com|es|org)$/");
    await expect(page.getByTestId("regex-canvas")).toContainText("O bien");
    await expect(page.locator('[data-testid="regex-matches"] li[data-matched="true"]')).toHaveCount(2);
    await page.getByRole("radio", { name: "Zod" }).click();
    await expect(page.getByTestId("regex-export")).toContainText("z.string().regex(");
  });

  test("Tester: highlights matches, groups and stops catastrophic patterns", async ({ page }) => {
    await openTool(page, "/en/regex-tester");
    await loadExample(page);
    await expect(page.getByText("3 of 5 match")).toBeVisible();
    await expect(page.getByTestId("regex-matches")).toContainText("year");
    await expect(page.getByTestId("regex-explanation")).toContainText("Capture group named “year”");

    await page.locator("#regex-pattern").fill("^(a+)+$");
    await page.getByRole("textbox", { name: "Test cases" }).click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.insertText("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!");
    await expect(page.getByText(/took too long and was stopped/)).toBeVisible({ timeout: 15_000 });
  });

  test("Library: browse patterns and open one in the Tester", async ({ page }) => {
    await openTool(page, "/es/regex-comunes");
    await page.getByRole("button", { name: /^DNI/ }).click();
    await expect(page.getByTestId("library-pattern")).toHaveText("/^\\d{8}[A-HJ-NP-TV-Z]$/i");
    await expect(page.locator('[data-testid="regex-matches"] li[data-matched="true"]')).toHaveCount(2);
    await page.getByRole("link", { name: "Abrir en el Tester" }).click();
    await expect(page).toHaveURL(/\/es\/probar-regex#/);
    await expect(page.locator("#regex-pattern")).toHaveValue("^\\d{8}[A-HJ-NP-TV-Z]$");
  });
});
