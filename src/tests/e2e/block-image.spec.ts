import { expect, test } from "@playwright/test";
import { converterOutput, loadExample, openTool } from "./helpers";

test.describe("3.11 Images", () => {
  test("SVG optimizer shrinks an Inkscape export and keeps the title", async ({ page }) => {
    await openTool(page, "/en/svg-optimizer");
    await loadExample(page);
    await expect(page.getByTestId("svg-savings")).toContainText("saved");
    const out = converterOutput(page);
    await expect(out).toContainText("<title>Rocket</title>");
    await expect(out).not.toContainText("inkscape");
    await expect(out).not.toContainText("metadata");
  });

  test("SVG → React builds a typed icon component", async ({ page }) => {
    await openTool(page, "/es/svg-a-react");
    await loadExample(page);
    const out = converterOutput(page);
    await expect(out).toContainText("export default function BellIcon({ size = 24, ...props }");
    await expect(out).toContainText('stroke="currentColor" strokeWidth="2" strokeLinecap="round"');
    await expect(out).toContainText('className="icon icon-bell"');
  });

  test("Favicon generator renders every icon and the tags", async ({ page }) => {
    await openTool(page, "/en/favicon-generator");
    await loadExample(page);
    await expect(page.getByTestId("favicon-icons").locator("li")).toHaveCount(7);
    await expect(page.getByTestId("favicon-tags")).toContainText(
      '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
    );
    await expect(page.getByRole("button", { name: "ZIP" }).first()).toBeVisible();
  });

  test("WebP converter encodes the sample and reports the saving", async ({ page }) => {
    await openTool(page, "/en/webp-converter");
    await loadExample(page);
    await expect(page.getByTestId("webp-result")).toContainText("WEBP · 1200×800");
    await expect(page.getByTestId("webp-result")).toContainText("saved");
    await page.getByRole("spinbutton", { name: /Max width/ }).fill("600");
    await expect(page.getByTestId("webp-result")).toContainText("600×400");
  });

  test("QR generator encodes a URL and a WiFi network", async ({ page }) => {
    await openTool(page, "/en/qr-code-generator");
    await loadExample(page);
    await expect(page.getByTestId("qr-image")).toBeVisible();
    await expect(page.getByTestId("qr-info")).toContainText("level M");
    await page.getByRole("radio", { name: "WiFi" }).click();
    await page.getByLabel("Network name (SSID)").fill("Guest");
    await page.getByLabel("Password", { exact: true }).fill("s3cret");
    await expect(page.getByTestId("qr-payload")).toHaveText("WIFI:T:WPA;S:Guest;P:••••;;");
  });
});
