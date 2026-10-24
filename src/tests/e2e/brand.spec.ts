import { expect, test, type APIRequestContext } from "@playwright/test";

/** Home, a tool and About in every language. */
const pages = [
  "/en",
  "/es",
  "/fr",
  "/pt",
  "/en/json-formatter",
  "/es/formatear-json",
  "/fr/formater-json",
  "/pt/formatar-json",
  "/en/about",
  "/es/about",
];

type Attrs = Record<string, string>;

/** Attributes of every <tag ...> of one kind in the server HTML. */
function tags(html: string, name: "link" | "meta"): Attrs[] {
  return [...html.matchAll(new RegExp(`<${name}\\s([^>]*?)/?>`, "g"))].map(([, body]) =>
    Object.fromEntries([...body.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v.replace(/&amp;/g, "&")])),
  );
}

const meta = (html: string, key: string) =>
  tags(html, "meta").find((m) => m.property === key || m.name === key)?.content;

const links = (html: string, rel: string) => tags(html, "link").filter((l) => l.rel === rel);

/** Metadata URLs are absolute on the production origin: fetch them from the test server. */
const local = (url: string) => url.replace(/^https?:\/\/[^/]+/, "");

async function expectAsset(request: APIRequestContext, url: string, type: RegExp) {
  const res = await request.get(local(url));
  expect(res.status(), url).toBe(200);
  expect(res.headers()["content-type"], url).toMatch(type);
  return res.body();
}

/** Width and height from a PNG's IHDR chunk. */
const pngSize = (png: Buffer) => ({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) });

for (const path of pages) {
  test(`${path} ships social images, icons and the manifest`, async ({ request }) => {
    const html = await (await request.get(path)).text();

    const og = meta(html, "og:image");
    const tw = meta(html, "twitter:image");
    expect(og, "og:image").toBeTruthy();
    expect(tw, "twitter:image").toBeTruthy();
    expect(meta(html, "og:site_name")).toBe("kitforweb");
    expect(meta(html, "twitter:card")).toBe("summary_large_image");
    expect(meta(html, "og:image:width")).toBe("1200");
    expect(meta(html, "og:image:height")).toBe("630");

    const ogPng = await expectAsset(request, og!, /^image\/png/);
    expect(pngSize(ogPng)).toEqual({ width: 1200, height: 630 });
    expect(pngSize(await expectAsset(request, tw!, /^image\/png/))).toEqual({ width: 1200, height: 630 });

    const icons = links(html, "icon");
    const svgIcon = icons.find((l) => l.type === "image/svg+xml");
    const ico = icons.find((l) => l.href.includes("favicon.ico"));
    expect(svgIcon, "SVG icon").toBeTruthy();
    expect(ico, "favicon.ico").toBeTruthy();
    await expectAsset(request, svgIcon!.href, /^image\/svg\+xml/);
    await expectAsset(request, ico!.href, /^image\/(x-icon|vnd\.microsoft\.icon)/);

    const [apple] = links(html, "apple-touch-icon");
    expect(apple, "apple-touch-icon").toBeTruthy();
    expect(pngSize(await expectAsset(request, apple.href, /^image\/png/))).toEqual({ width: 180, height: 180 });

    const [manifest] = links(html, "manifest");
    expect(manifest, "manifest").toBeTruthy();
    await expectAsset(request, manifest.href, /^application\/manifest\+json/);
  });
}

test("the manifest icons exist with their declared sizes", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({
    name: "kitforweb",
    short_name: "kitforweb",
    display: "standalone",
    theme_color: "#0B1120",
    background_color: "#0B1120",
  });
  expect(manifest.icons.some((i: Attrs) => i.purpose === "maskable")).toBe(true);
  for (const icon of manifest.icons as Attrs[]) {
    const [w, h] = icon.sizes.split("x").map(Number);
    expect(pngSize(await expectAsset(request, icon.src, /^image\/png/))).toEqual({ width: w, height: h });
  }
});

test("JSON-LD points to the 512px logo", async ({ request }) => {
  const home = await (await request.get("/en")).text();
  expect(home).toContain('"@type":"Organization"');
  expect(home).toContain('"logo":{"@type":"ImageObject","url":"https://kitforweb.com/brand/icon-512.png"');
  const about = await (await request.get("/es/about")).text();
  expect(about).toContain('"image":{"@type":"ImageObject","url":"https://kitforweb.com/brand/icon-512.png"');
  await expectAsset(request, "/brand/icon-512.png", /^image\/png/);
});
