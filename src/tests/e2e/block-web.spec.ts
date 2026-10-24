import { expect, test } from "@playwright/test";
import { converterOutput, loadExample, openTool } from "./helpers";

test.describe("3.6 Web and HTTP", () => {
  test("cURL → fetch converts a DevTools command", async ({ page }) => {
    await openTool(page, "/en/curl-to-fetch");
    await loadExample(page);
    await expect(converterOutput(page)).toContainText('await fetch("https://api.example.com/v1/orders?status=paid", {');
    await expect(converterOutput(page)).toContainText('method: "POST",');
    await page.getByRole("radio", { name: "axios" }).click();
    await expect(converterOutput(page)).toContainText('import axios from "axios";');
  });

  test("HTTP status codes: search and explanation", async ({ page }) => {
    await openTool(page, "/es/codigos-http");
    await loadExample(page);
    const detail = page.getByTestId("status-detail");
    await expect(detail).toContainText("429");
    await expect(detail).toContainText("Too Many Requests");
    await expect(detail).toContainText("Retry-After");
    await page.getByRole("searchbox", { name: /404/ }).fill("teapot");
    await expect(page.getByTestId("status-list").locator("li")).toHaveCount(1);
  });

  test("HTTP headers flags missing security headers and risky cookies", async ({ page }) => {
    await openTool(page, "/en/http-headers-analyzer");
    await loadExample(page);
    const issues = page.getByTestId("header-issues");
    await expect(issues).toContainText("No Content-Security-Policy");
    await expect(issues).toContainText("Cookie “session” lacks Secure");
    await expect(issues).toContainText("nginx/1.25.3");
    await expect(page.getByTestId("header-list")).toContainText("Forces HTTPS for this domain");
  });

  test("Meta tags previews and generates the tags", async ({ page }) => {
    await openTool(page, "/en/meta-tags-generator");
    await loadExample(page);
    await expect(page.getByTestId("preview-google")).toContainText("kitforweb.com › en");
    await expect(converterOutput(page)).toContainText('<meta property="og:title"');
    await expect(converterOutput(page)).toContainText("<!-- Open Graph -->");
  });

  test("User-Agent parses an iPhone", async ({ page }) => {
    await openTool(page, "/en/user-agent-parser");
    await loadExample(page);
    await expect(page.getByTestId("ua-summary")).toContainText("Mobile Safari 17 · iOS");
    await expect(page.getByTestId("ua-details")).toContainText("Mobile · Apple · iPhone");
  });

  test("Semver checks a range and sorts versions", async ({ page }) => {
    await openTool(page, "/es/comprobar-semver");
    await loadExample(page);
    await expect(page.getByTestId("semver-check")).toContainText("1.4.0 cumple ^1.2.3");
    await expect(page.getByTestId("semver-check")).toContainText(">=1.2.3 <2.0.0-0");
    await expect(page.getByTestId("semver-sorted").locator("li")).toHaveText([
      "0.9.12",
      "1.2.0-beta.2",
      "1.2.0",
      "1.9.3",
      "1.10.0",
      "2.0.0-rc.1",
    ]);
  });
});
