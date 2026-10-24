import { expect, type Locator, type Page } from "@playwright/test";

/** Opens a tool page and waits for its client component to mount. */
export async function openTool(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("toolbar", { name: /Actions|Acciones/ })).toBeVisible({ timeout: 15_000 });
}

export async function loadExample(page: Page, name: RegExp | string = /^(Example|Ejemplo)$/) {
  await page.getByRole("button", { name }).first().click();
}

/** Text of the read-only result editor of a converter tool. */
export function converterOutput(page: Page): Locator {
  return page.getByTestId("converter-output").locator(".cm-content").first();
}

/** Replaces the content of the CodeMirror editor inside `region`. */
export async function typeInEditor(page: Page, editor: Locator, text: string) {
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(text);
}
