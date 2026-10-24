import { expect, test } from "@playwright/test";
import { converterOutput, loadExample, openTool } from "./helpers";

test.describe("3.1 JSON", () => {
  test("JSON → TypeScript generates interfaces in a worker", async ({ page }) => {
    await openTool(page, "/en/json-to-typescript");
    await loadExample(page);
    await expect(converterOutput(page)).toContainText("export interface User {", { timeout: 20_000 });
    await expect(converterOutput(page)).toContainText("email?:");
  });

  test("JSON → Zod generates a schema", async ({ page }) => {
    await openTool(page, "/es/json-a-zod");
    await loadExample(page);
    await expect(converterOutput(page)).toContainText("export const TaskSchema = z.object({", { timeout: 20_000 });
  });

  test("JSON → Mock generates the requested number of records", async ({ page }) => {
    await openTool(page, "/en/json-mock-data-generator");
    await loadExample(page);
    await page.getByLabel("Records").fill("3");
    await expect(converterOutput(page)).toContainText('"firstName":');
    await expect(converterOutput(page)).toContainText('"id": 1');
  });

  test("JSON Diff lists changes by path", async ({ page }) => {
    await openTool(page, "/en/json-diff");
    await loadExample(page);
    const list = page.getByRole("list", { name: "Differences" });
    await expect(list).toContainText("user.address.city");
    await expect(list).toContainText('"London"');
    await expect(list).toContainText("features[2]");
    await expect(page.getByText("2 added")).toBeVisible();
    await expect(page.getByText("1 removed")).toBeVisible();
  });

  test("JSON ↔ YAML converts both ways", async ({ page }) => {
    await openTool(page, "/en/json-to-yaml");
    await loadExample(page);
    await expect(converterOutput(page)).toContainText("runs-on: ubuntu-latest");
    await page.getByRole("button", { name: "Swap" }).click();
    await expect(page.getByRole("toolbar").getByText("YAML → JSON")).toBeVisible();
    await expect(converterOutput(page)).toContainText('"runs-on": "ubuntu-latest"');
  });

  test("JSON ↔ CSV flattens nested objects", async ({ page }) => {
    await openTool(page, "/es/json-a-csv");
    await loadExample(page);
    await expect(converterOutput(page)).toContainText("id,name,email,address.city,address.country,active");
    await page.getByRole("button", { name: "Intercambiar" }).click();
    await expect(converterOutput(page)).toContainText('"city": "London"');
  });
});
