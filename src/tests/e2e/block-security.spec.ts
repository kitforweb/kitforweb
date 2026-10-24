import { expect, test } from "@playwright/test";
import { loadExample, openTool } from "./helpers";

test.describe("3.3 Security", () => {
  test("Hash computes every digest and verifies a checksum", async ({ page }) => {
    await openTool(page, "/en/hash-generator");
    await loadExample(page);
    await expect(page.getByTestId("digest-MD5")).toHaveText("9e107d9d372bb6826bd81d3542a419d6");
    await expect(page.getByTestId("digest-SHA-256")).toHaveText(
      "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592",
    );
    await page
      .getByLabel("Expected hash (optional)")
      .fill("D7A8FBB307D7809469CA9ABCB0082E4F8D5651E46D3CDB762D02D0BF37C9E592");
    await expect(page.getByText("Matches the SHA-256 hash")).toBeVisible();
  });

  test("HMAC signs a webhook body and checks the received signature", async ({ page }) => {
    await openTool(page, "/en/hmac-generator");
    await loadExample(page);
    const hex = "ca5a82e97850f2e4aaee54a1ff855afba6539309d597b6e94e8784ba789bb07a";
    await expect(page.getByTestId("hmac-hex")).toHaveText(hex);
    await page.getByLabel("Signature received (optional)").fill(`sha256=${hex}`);
    await expect(page.getByText("Signature matches")).toBeVisible();
  });

  test("UUID generates in bulk and inspects a v7", async ({ page }) => {
    await openTool(page, "/es/generador-uuid");
    await loadExample(page);
    await expect(page.getByTestId("uuid-info")).toContainText("Versión 7");
    await expect(page.getByTestId("uuid-info")).toContainText("2024");
    const items = page.getByTestId("uuid-list").locator("li");
    await expect(items).toHaveCount(5);
    await expect(items.first()).toHaveText(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  test("Bcrypt hashes and verifies a password", async ({ page }) => {
    await openTool(page, "/en/bcrypt-generator");
    await loadExample(page);
    await expect(page.getByText("The password matches the hash")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("bcrypt-hash")).toHaveText(/^\$2b\$10\$[./A-Za-z0-9]{53}$/, { timeout: 20_000 });
  });

  test("Password generator honours the length and builds a .env line", async ({ page }) => {
    await openTool(page, "/en/password-generator");
    await loadExample(page);
    await expect(page.getByTestId("pw-length")).toHaveText("24");
    const first = page.getByTestId("password-list").locator("li span").first();
    await expect(first).toHaveText(/^.{24}$/);
    await expect(page.getByTestId("env-line")).toHaveText(/^SECRET_KEY=[0-9a-f]{64}$/);
  });

  test("Keys converts PEM to JWK and generates new pairs", async ({ page }) => {
    await openTool(page, "/en/rsa-ec-key-generator");
    await loadExample(page);
    await expect(page.getByTestId("converted-key")).toContainText('"crv": "P-256"');
    await page.getByRole("radio", { name: "Generate" }).click();
    await page.getByRole("button", { name: "Generate key pair" }).click();
    await expect(page.getByTestId("public-pem")).toContainText("-----BEGIN PUBLIC KEY-----");
  });

  test("X.509 decodes subject, SAN and validity", async ({ page }) => {
    await openTool(page, "/en/x509-certificate-decoder");
    await loadExample(page);
    await expect(page.getByRole("heading", { name: "kitforweb.example" })).toBeVisible();
    await expect(page.getByText("www.kitforweb.example")).toBeVisible();
    await expect(page.getByText(/Valid · \d+ days left/)).toBeVisible();
  });
});
