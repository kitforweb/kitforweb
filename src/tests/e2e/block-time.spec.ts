import { expect, test } from "@playwright/test";
import { loadExample, openTool } from "./helpers";

test.use({ timezoneId: "Europe/Madrid" });

test.describe("3.5 Time", () => {
  test("Timestamp converts an epoch to every format", async ({ page }) => {
    await openTool(page, "/en/unix-timestamp-converter");
    await expect(page.getByTestId("now-seconds")).toHaveText(/^\d{10}$/);
    await loadExample(page);
    const formats = page.getByTestId("timestamp-formats");
    await expect(formats).toContainText("2023-11-14T22:13:20.000Z");
    await expect(formats).toContainText("1700000000000");
    await expect(page.getByText("Interpreted as seconds since 1 January 1970 UTC")).toBeVisible();
  });

  test("Time zones show a meeting across cities", async ({ page }) => {
    await openTool(page, "/en/time-zone-converter");
    await loadExample(page);
    const list = page.getByTestId("zone-list");
    // 10 March 2026, 16:00 in Madrid (UTC+1). The US is already on DST (since 8 March): New York UTC-4 = 11:00.
    await expect(list.locator("li", { hasText: "Madrid" })).toContainText("16:00");
    await expect(list.locator("li", { hasText: "New York" })).toContainText("11:00");
    await expect(list.locator("li", { hasText: "Tokyo" })).toContainText("+1d");
  });

  test("Date difference counts days and shifts dates", async ({ page }) => {
    await openTool(page, "/es/diferencia-entre-fechas");
    await loadExample(page);
    await expect(page.getByTestId("diff-parts")).toContainText("11 meses");
    await expect(page.getByTestId("diff-totals")).toContainText("357");
    // 31 January + 1 month = end of February.
    await expect(page.getByTestId("shift-result")).toContainText("28 de febrero de 2026");
  });

  test("Cron explains an expression and lists the next runs", async ({ page }) => {
    await openTool(page, "/es/expresion-cron");
    await loadExample(page);
    await expect(page.getByTestId("cron-description")).toHaveText(
      "Cada 15 minutos, entre las 09:00 y las 17:59, de lunes a viernes",
    );
    await expect(page.getByTestId("cron-next").locator("li")).toHaveCount(10);
    await expect(page.locator("#cron-hour")).toHaveValue("9-17");
  });
});
