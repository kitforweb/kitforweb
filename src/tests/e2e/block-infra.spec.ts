import { expect, test } from "@playwright/test";
import { converterOutput, loadExample, openTool } from "./helpers";

test.describe("3.8 Back: infrastructure", () => {
  test("docker run → compose builds two services and a named volume", async ({ page }) => {
    await openTool(page, "/en/docker-run-to-compose");
    await loadExample(page);
    const out = converterOutput(page);
    await expect(out).toContainText("image: postgres:16-alpine");
    await expect(out).toContainText('- "5432:5432"');
    await expect(out).toContainText("- CMD-SHELL");
    await expect(out).toContainText("image: adminer");
    await expect(out).toContainText("pgdata: {}");
  });

  test("CIDR describes the block, checks an IP and splits it", async ({ page }) => {
    await openTool(page, "/en/cidr-calculator");
    await loadExample(page);
    const details = page.getByTestId("cidr-details");
    await expect(details).toContainText("255.255.252.0");
    await expect(details).toContainText("10.20.3.254");
    await expect(details).toContainText("1,022");
    await expect(page.getByTestId("cidr-contains")).toContainText("10.20.3.17 is inside the block.");
    await expect(page.getByTestId("cidr-subnets").locator("li")).toHaveCount(4);
    await expect(page.getByTestId("cidr-subnets")).toContainText("10.20.3.0/24");
  });

  test("chmod reads a command and the checkboxes update the mode", async ({ page }) => {
    await openTool(page, "/es/calculadora-chmod");
    await loadExample(page);
    await expect(page.getByTestId("chmod-octal")).toContainText("750");
    await expect(page.getByTestId("chmod-symbolic")).toContainText("rwxr-x---");
    await expect(page.getByTestId("chmod-result")).toContainText("chmod -R 750 /srv/app");
    await expect(page.getByTestId("chmod-preview")).toContainText("750 → 770");
    await page.getByRole("checkbox", { name: "Otros · Lectura" }).check();
    await expect(page.getByTestId("chmod-octal")).toContainText("754");
  });

  test(".env → JSON reports duplicates and keeps the last value", async ({ page }) => {
    await openTool(page, "/es/env-a-json");
    await loadExample(page);
    await expect(converterOutput(page)).toContainText('"PORT": "8080"');
    await expect(converterOutput(page)).toContainText('"DB__PASSWORD": "s3cr3t#!"');
    const warnings = page.getByTestId("converter-warnings");
    await expect(warnings).toContainText("Línea 10: PORT ya está definida en la línea 3");
    await expect(warnings).toContainText("Línea 11: los espacios alrededor del =");
  });
});
