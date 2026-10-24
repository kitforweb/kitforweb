import { expect, test } from "@playwright/test";
import { converterOutput, loadExample, openTool } from "./helpers";

test.describe("3.11 Images", () => {
  test("SVG optimizer shrinks the commented brand wordmark and keeps the title", async ({ page }) => {
    await openTool(page, "/en/svg-optimizer");
    await loadExample(page);
    await expect(page.getByTestId("svg-savings")).toContainText("saved");
    const out = converterOutput(page);
    await expect(out).toContainText("<title>kitforweb</title>");
    await expect(out).not.toContainText("<!--");
  });

  test("SVG → React builds a typed component from the brand icon", async ({ page }) => {
    await openTool(page, "/es/svg-a-react");
    await loadExample(page);
    const out = converterOutput(page);
    await expect(out).toContainText("export default function LogoIcon({ size = 24, ...props }");
    // Multicolor logo: the example keeps its colors and camel-cases the attributes.
    await expect(out).toContainText('fill="#22D3EE"');
    await expect(out).toContainText('strokeOpacity=".35" strokeWidth="3"');
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

  test("WebP converter encodes the brand banner and reports the saving", async ({ page }) => {
    await openTool(page, "/en/webp-converter");
    await loadExample(page);
    await expect(page.getByTestId("webp-original")).toContainText("kitforweb-banner.png");
    await expect(page.getByTestId("webp-result")).toContainText("WEBP · 1280×640");
    await expect(page.getByTestId("webp-result")).toContainText("saved");
    await page.getByRole("spinbutton", { name: /Max width/ }).fill("600");
    await expect(page.getByTestId("webp-result")).toContainText("600×300");
  });

  test("QR generator encodes a URL with the brand logo and a WiFi network", async ({ page }) => {
    await openTool(page, "/en/qr-code-generator");
    await loadExample(page);
    await expect(page.getByTestId("qr-image")).toBeVisible();
    // The example adds the logo, which forces the highest error correction.
    await expect(page.getByTestId("qr-info")).toContainText("level H");
    await expect(page.getByRole("button", { name: "Remove logo" })).toBeVisible();
    await page.getByRole("radio", { name: "WiFi" }).click();
    await page.getByLabel("Network name (SSID)").fill("Guest");
    await page.getByLabel("Password", { exact: true }).fill("s3cret");
    await expect(page.getByTestId("qr-payload")).toHaveText("WIFI:T:WPA;S:Guest;P:••••;;");
  });
});
