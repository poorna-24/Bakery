import { describe, expect, it } from "vitest";
import { menuQrPng, menuQrSvg, menuUrl, tableCardHtml } from "./qr";

function headersOf(values: Record<string, string>): Headers {
  return new Headers(values);
}

describe("menuUrl", () => {
  it("uses SITE_URL when it is a public address", () => {
    expect(menuUrl(headersOf({ host: "bakery-x.vercel.app" }), "https://menu.shop.com/")).toBe(
      "https://menu.shop.com",
    );
  });

  // The value copied from .env.example must not send customers to localhost.
  it.each(["http://localhost:3000", "http://127.0.0.1:3000"])(
    "ignores a local SITE_URL (%s) in favour of the real host",
    (siteUrl) => {
      expect(menuUrl(headersOf({ host: "bakery-x.vercel.app" }), siteUrl)).toBe(
        "https://bakery-x.vercel.app",
      );
    },
  );

  it("uses the host the dashboard was opened on when SITE_URL is unset", () => {
    expect(menuUrl(headersOf({ host: "bakery-x.vercel.app" }), undefined)).toBe(
      "https://bakery-x.vercel.app",
    );
    expect(menuUrl(headersOf({ host: "bakery-x.vercel.app" }), "  ")).toBe(
      "https://bakery-x.vercel.app",
    );
  });

  it("prefers what the proxy says over the inner host", () => {
    const headers = headersOf({
      host: "internal:3000",
      "x-forwarded-host": "menu.shop.com, internal",
      "x-forwarded-proto": "https, http",
    });
    expect(menuUrl(headers, undefined)).toBe("https://menu.shop.com");
  });

  it("speaks plain http to a local host", () => {
    expect(menuUrl(headersOf({ host: "localhost:3000" }), undefined)).toBe("http://localhost:3000");
    expect(menuUrl(headersOf({ host: "127.0.0.1:3000" }), undefined)).toBe("http://127.0.0.1:3000");
  });

  it("falls back to SITE_URL, then localhost, when there is no host at all", () => {
    expect(menuUrl(headersOf({}), "http://localhost:4000")).toBe("http://localhost:4000");
    expect(menuUrl(headersOf({}), undefined)).toBe("http://localhost:3000");
  });
});

describe("the code itself", () => {
  it("draws an SVG", async () => {
    const svg = await menuQrSvg("https://menu.shop.com");
    expect(svg).toMatch(/^<svg[\s\S]*<\/svg>\s*$/);
    // Brown, matching the printed table cards.
    expect(svg.toLowerCase()).toContain("#3a2418");
  });

  it("draws a PNG", async () => {
    const png = await menuQrPng("https://menu.shop.com");
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it("encodes a different address as a different code", async () => {
    expect(await menuQrSvg("https://a.example")).not.toBe(await menuQrSvg("https://b.example"));
  });
});

describe("tableCardHtml", () => {
  it("puts the shop name and the code on the card", () => {
    const html = tableCardHtml("Shivam Bakery", "<svg>code</svg>");
    expect(html).toContain("<h1>Shivam Bakery</h1>");
    expect(html).toContain('<div class="qr"><svg>code</svg></div>');
    expect(html).toContain("Scan for our menu");
  });

  it("escapes the shop name, which comes from settings", () => {
    const html = tableCardHtml(`Tom & Jerry's <b>"Cakes"</b>`, "<svg></svg>");
    expect(html).toContain("<h1>Tom &amp; Jerry's &lt;b&gt;&quot;Cakes&quot;&lt;/b&gt;</h1>");
    expect(html).not.toContain("<b>");
  });
});
