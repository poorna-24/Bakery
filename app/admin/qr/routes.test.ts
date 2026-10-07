import { afterEach, describe, expect, it } from "vitest";
import { GET as svgDownload } from "./menu-qr.svg/route";
import { GET as pngDownload } from "./menu-qr.png/route";
import { GET as tableCard } from "./table-card/route";

// The QR downloads on the dashboard's QR page. The login check lives in
// middleware.ts, which matches all of /admin; these cover what is served.

const originalSiteUrl = process.env.SITE_URL;
const originalShopName = process.env.SHOP_NAME;

afterEach(() => {
  if (originalSiteUrl === undefined) delete process.env.SITE_URL;
  else process.env.SITE_URL = originalSiteUrl;
  if (originalShopName === undefined) delete process.env.SHOP_NAME;
  else process.env.SHOP_NAME = originalShopName;
});

function requestFrom(host: string): Request {
  delete process.env.SITE_URL;
  return new Request(`https://${host}/admin/qr`, { headers: { host } });
}

describe("QR downloads", () => {
  it("serves the SVG as a file to save", async () => {
    const response = await svgDownload(requestFrom("menu.shop.com"));

    expect(response.headers.get("content-type")).toMatch(/^image\/svg\+xml/);
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="menu-qr.svg"');
    expect(await response.text()).toMatch(/^<svg/);
  });

  it("serves the PNG as a file to save", async () => {
    const response = await pngDownload(requestFrom("menu.shop.com"));

    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="menu-qr.png"');
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  // Never cached: the code must follow the site if its address changes.
  it.each([svgDownload, pngDownload, tableCard])("is never cached", async (handler) => {
    const response = await handler(requestFrom("menu.shop.com"));
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("encodes the site the dashboard is on", async () => {
    const here = await (await svgDownload(requestFrom("menu.shop.com"))).text();
    const elsewhere = await (await svgDownload(requestFrom("other.shop.com"))).text();
    expect(here).not.toBe(elsewhere);
  });
});

describe("the table card", () => {
  it("is a page to view and print, with the shop's name", async () => {
    process.env.SHOP_NAME = "Shivam Bakery";
    const response = await tableCard(requestFrom("menu.shop.com"));

    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBeNull();
    const html = await response.text();
    expect(html).toContain("<h1>Shivam Bakery</h1>");
    expect(html).toContain("<svg");
  });

  it("falls back to a generic name when none is set", async () => {
    delete process.env.SHOP_NAME;
    const html = await (await tableCard(requestFrom("menu.shop.com"))).text();
    expect(html).toContain("<h1>Our Bakery</h1>");
  });
});
