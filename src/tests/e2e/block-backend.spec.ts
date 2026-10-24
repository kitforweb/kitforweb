import { expect, test } from "@playwright/test";
import { converterOutput, loadExample, openTool } from "./helpers";

test.describe("3.7 Back: SQL and APIs", () => {
  test("SQL formatter puts each clause on its own line", async ({ page }) => {
    await openTool(page, "/en/sql-formatter");
    await loadExample(page);
    await expect(converterOutput(page)).toContainText("SELECT");
    await expect(converterOutput(page)).toContainText("LEFT JOIN orders o ON o.user_id = u.id");
    await expect(converterOutput(page)).toContainText("HAVING");
  });

  test("SQL → ER diagram draws tables and relations", async ({ page }) => {
    await openTool(page, "/es/sql-a-diagrama-er");
    await loadExample(page);
    await expect(page.getByTestId("er-summary")).toContainText("4 tablas");
    await expect(page.getByTestId("er-diagram").locator("svg")).toBeVisible({ timeout: 15_000 });
  });

  test("OpenAPI viewer lists the operations", async ({ page }) => {
    await openTool(page, "/en/openapi-viewer");
    await loadExample(page);
    await expect(page.getByTestId("api-title")).toContainText("Bookstore API");
    await expect(page.getByTestId("api-operation")).toHaveCount(3);
    await expect(page.getByTestId("api-operation").first()).toContainText("/books");
  });

  test("JSON Schema validator reports each failing field", async ({ page }) => {
    await openTool(page, "/en/json-schema-validator");
    await loadExample(page);
    const errors = page.getByTestId("schema-errors");
    await expect(errors).toContainText("emailLn 3");
    await expect(errors).toContainText("must be a valid email");
    await expect(errors).toContainText("must be one of");
    await expect(errors).toContainText("unexpected property “trial”");
  });

  test("XML → JSON keeps attributes", async ({ page }) => {
    await openTool(page, "/en/xml-to-json");
    await loadExample(page);
    await expect(converterOutput(page)).toContainText('"@_number": "INV-2026-042"');
    await expect(converterOutput(page)).toContainText('"name": "Ada Lovelace"');
  });

  test("XML formatter indents a SOAP envelope", async ({ page }) => {
    await openTool(page, "/es/formatear-xml");
    await loadExample(page);
    await expect(converterOutput(page)).toContainText("<soap:Envelope");
    await expect(converterOutput(page)).toContainText("<OrderId>1042</OrderId>");
    await expect(converterOutput(page)).toContainText("<![CDATA[Ship <fast> & safe]]>");
  });
});
