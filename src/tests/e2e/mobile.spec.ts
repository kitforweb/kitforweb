import { expect, test } from "@playwright/test";

test("mobile: bottom navigation opens the explorer and panels stack", async ({ page }) => {
  await page.goto("/en/json-formatter");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("button", { name: "Search" }).click();
  await page.getByRole("complementary").getByRole("link", { name: "JWT Decoder" }).click();
  await expect(page).toHaveURL(/\/en\/jwt-decoder$/);
  await expect(page.getByRole("complementary")).toBeHidden();
  const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalScroll).toBe(false);
});
