import { expect, test } from "@playwright/test";
import { converterOutput, loadExample, openTool } from "./helpers";

test.describe("3.2 Encoding and tokens", () => {
  test("JWT Generator signs a token and hands it to the decoder in memory", async ({ page }) => {
    await openTool(page, "/en/jwt-generator");
    await loadExample(page);
    const token = page.getByTestId("jwt-token");
    await expect(token).toContainText("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    await page.getByRole("button", { name: "Open in JWT Decoder" }).click();
    await expect(page).toHaveURL(/\/en\/jwt-decoder$/);
    await expect(page.getByText('"name": "Ada Lovelace"')).toBeVisible();
  });

  test("URL parameters are decoded, including the fragment and nested URLs", async ({ page }) => {
    await openTool(page, "/es/parametros-url");
    await loadExample(page);
    await expect(page.getByLabel("Valor de q")).toHaveValue("café con leche");
    await expect(page.getByRole("region", { name: "Fragmento (#)" })).toContainText("access_token");
    await expect(page.getByText("app.example.com/callback")).toBeVisible();
    await page.getByLabel("Valor de q").fill("té");
    await expect(page.getByTestId("rebuilt-url")).toContainText("q=t%C3%A9");
  });

  test("Base64 encodes UTF-8 and decodes back", async ({ page }) => {
    await openTool(page, "/en/base64-encode-decode");
    await loadExample(page);
    await expect(converterOutput(page)).toHaveText("SG9sYSwga2l0Zm9yd2ViIPCfkYs=");
    await page.getByRole("button", { name: "Swap" }).click();
    await expect(converterOutput(page)).toHaveText("Hola, kitforweb 👋");
  });

  test("URL Encode shows encodeURIComponent and encodeURI", async ({ page }) => {
    await openTool(page, "/en/url-encode-decode");
    await loadExample(page);
    await expect(page.getByTestId("encoded-component")).toContainText(
      "https%3A%2F%2Fexample.com%2Fb%C3%BAsqueda%3Fq%3Dcaf%C3%A9%20",
    );
    await expect(page.getByTestId("encoded-uri")).toContainText("https://example.com/b%C3%BAsqueda?q=caf%C3%A9%20con");
  });

  test("HTML Entities escapes markup", async ({ page }) => {
    await openTool(page, "/en/html-entities");
    await loadExample(page);
    await expect(converterOutput(page)).toContainText("&lt;p class=&quot;note&quot;&gt;Tom &amp; Jerry&#39;s");
  });

  test("Unicode flags invisible characters", async ({ page }) => {
    await openTool(page, "/en/unicode-inspector");
    await loadExample(page);
    await expect(page.getByRole("cell", { name: "U+200B" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "ZERO WIDTH SPACE" })).toBeVisible();
    await expect(page.getByText("1 invisible character")).toBeVisible();
  });

  test("Hex ↔ Binary converts numbers and text", async ({ page }) => {
    await openTool(page, "/en/hex-binary-converter");
    await loadExample(page);
    await expect(page.getByTestId("number-summary")).toContainText("12648430");
    await expect(page.getByLabel("BIN (2)")).toHaveValue("110000001111111111101110");
    await page.getByRole("radio", { name: "Text ↔ bytes" }).click();
    await loadExample(page);
    await expect(converterOutput(page)).toHaveText("48 6f 6c 61 20 f0 9f 91 8b");
  });

  test("Punycode converts international domains", async ({ page }) => {
    await openTool(page, "/es/convertir-punycode");
    await loadExample(page);
    await expect(converterOutput(page)).toContainText("xn--espaa-rta.com");
    await expect(converterOutput(page)).toContainText("info@xn--nio-8ma.com");
  });

  test("Gzip compresses to Base64 and back", async ({ page }) => {
    await openTool(page, "/en/gzip-compress-decompress");
    await loadExample(page);
    await expect(converterOutput(page)).toContainText("H4sI");
    await expect(page.getByText(/% smaller/)).toBeVisible();
    await page.getByRole("button", { name: "Swap" }).click();
    await expect(converterOutput(page)).toContainText('"users": [');
  });
});
