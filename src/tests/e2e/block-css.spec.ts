import { expect, test } from "@playwright/test";
import { loadExample, openTool } from "./helpers";

test.describe("3.10 CSS", () => {
  test("Type scale builds fluid steps and exports them", async ({ page }) => {
    await openTool(page, "/en/fluid-type-scale");
    await loadExample(page);
    await expect(page.getByTestId("type-steps").locator("li")).toHaveCount(8);
    await expect(page.getByTestId("type-code")).toContainText("--step-0: clamp(1rem, 0.9022rem + 0.4348vw, 1.25rem);");
    await page.getByRole("radio", { name: "Tailwind v4" }).click();
    await expect(page.getByTestId("type-code")).toContainText("--text-base: clamp(");
  });

  test("Color converter shows every format", async ({ page }) => {
    await openTool(page, "/en/color-converter");
    await loadExample(page);
    await expect(page.getByTestId("color-rgb")).toHaveText("rgb(59 130 246)");
    await expect(page.getByTestId("color-oklch")).toHaveText("oklch(62.31% 0.188 259.81)");
  });

  test("Color scale keeps the base color and exports a theme", async ({ page }) => {
    await openTool(page, "/es/generador-escala-colores");
    await loadExample(page);
    const swatches = page.getByTestId("scale-swatches").locator("li");
    await expect(swatches).toHaveCount(11);
    await expect(page.getByTestId("scale-swatches")).toContainText("#6d28d9");
    await expect(page.getByTestId("scale-code")).toContainText("--color-brand-50: oklch(");
  });

  test("Contrast fails AA and the suggestion fixes it", async ({ page }) => {
    await openTool(page, "/en/contrast-checker");
    await loadExample(page);
    await expect(page.getByTestId("contrast-ratio")).toHaveText(/^3\.\d+:1$/);
    await expect(page.locator('[data-testid="contrast-levels"] li[data-pass="false"]')).toHaveCount(3);
    await page.getByTestId("contrast-suggestions").getByRole("button", { name: "Use" }).first().click();
    await expect(page.getByTestId("contrast-ratio")).toHaveText(/^4\.[5-9]\d*:1$/);
  });

  test("Box-shadow edits layers and applies presets", async ({ page }) => {
    await openTool(page, "/en/box-shadow-generator");
    await loadExample(page);
    await expect(page.getByTestId("shadow-layers").locator("> li")).toHaveCount(3);
    await expect(page.getByTestId("shadow-css")).toContainText("inset 0 0 0 1px rgb(255 255 255 / 0.6)");
    await page.getByRole("button", { name: "lg", exact: true }).click();
    await expect(page.getByTestId("shadow-css")).toContainText("0 10px 15px -3px rgb(0 0 0 / 0.1)");
  });

  test("Gradient generator switches type", async ({ page }) => {
    await openTool(page, "/en/css-gradient-generator");
    await loadExample(page);
    await expect(page.getByTestId("gradient-css")).toHaveText(
      "background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 45%, #d946ef 100%);",
    );
    await page.getByRole("radio", { name: "Radial" }).click();
    await expect(page.getByTestId("gradient-css")).toContainText("radial-gradient(circle at 50% 50%, #0ea5e9 0%");
  });

  test("cubic-bezier loads a preset and recognises keywords", async ({ page }) => {
    await openTool(page, "/en/cubic-bezier-editor");
    await loadExample(page);
    await expect(page.getByTestId("bezier-css")).toContainText("cubic-bezier(0.34, 1.56, 0.64, 1)");
    await page.getByRole("combobox", { name: "Presets" }).click();
    await page.getByRole("option", { name: "ease-in-out", exact: true }).click();
    await expect(page.getByTestId("bezier-css")).toHaveText("transition-timing-function: ease-in-out;");
  });

  test("px → rem converts a CSS block", async ({ page }) => {
    await openTool(page, "/en/px-to-rem");
    await loadExample(page);
    const out = page.getByTestId("converter-output");
    await expect(out).toContainText("padding: 1.5rem 2rem;");
    await expect(out).toContainText("border: 1px solid #e2e8f0;");
    await expect(page.getByText("6 values converted")).toBeVisible();
  });
});
