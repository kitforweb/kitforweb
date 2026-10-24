import { expect, test } from "@playwright/test";

/**
 * The IDE frame is one viewport tall and only its panels scroll. Nothing may
 * stretch the document (e.g. an absolute `sr-only` label placed against the
 * root), or the whole page scrolls and the tab bar leaves the screen.
 */
test("no page scrolls the document, even with its example loaded", async ({ page, request }) => {
  test.setTimeout(300_000);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  const paths = [...sitemap.matchAll(/<loc>https?:\/\/[^/]+(\/en(?:\/[^<]*)?)<\/loc>/g)].map(([, p]) => p);
  expect(paths.length).toBeGreaterThan(60);

  // Records the tallest the document gets on every frame: some overflow is transient (e.g. while rendering).
  await page.addInitScript(() => {
    const w = window as typeof window & { maxScrollHeight?: number };
    w.maxScrollHeight = 0;
    const sample = () => {
      if (document.scrollingElement) {
        w.maxScrollHeight = Math.max(w.maxScrollHeight!, document.scrollingElement.scrollHeight);
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

  const overflowing: string[] = [];
  for (const path of paths) {
    await page.goto(path);
    const isTool = path !== "/en" && path !== "/en/about";
    if (isTool) {
      // The tool is a client component: wait until it mounts before loading its example.
      await expect(page.getByRole("toolbar", { name: "Actions" })).toBeVisible({ timeout: 15_000 });
      const example = page.getByRole("button", { name: "Example", exact: true });
      if ((await example.count()) > 0) await example.first().click();
    }
    await page.waitForTimeout(1_000);
    const { maxScrollHeight, innerHeight } = await page.evaluate(() => ({
      maxScrollHeight: (window as typeof window & { maxScrollHeight: number }).maxScrollHeight,
      innerHeight: window.innerHeight,
    }));
    if (maxScrollHeight > innerHeight) overflowing.push(`${path} (${maxScrollHeight}px > ${innerHeight}px)`);
  }
  expect(overflowing).toEqual([]);
});
