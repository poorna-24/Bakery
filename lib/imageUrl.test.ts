import { describe, expect, it } from "vitest";
import {
  checkImageUrl,
  isAcceptableImageType,
  isShortLink,
  unwrapGoogleImageUrl,
} from "./imageUrl";

const ok = (raw: string) => checkImageUrl(raw).ok;
const errorFor = (raw: string) => {
  const result = checkImageUrl(raw);
  return result.ok ? null : result.error;
};

describe("links the owner is likely to paste", () => {
  it("accepts a direct image address", () => {
    expect(ok("https://example.com/cakes/choco-truffle.jpg")).toBe(true);
  });

  it("accepts one with a query string, which image hosts always add", () => {
    expect(ok("https://images.example.com/photo.jpg?w=800&auto=format")).toBe(true);
  });

  it("accepts plain http, since some older shop sites still use it", () => {
    expect(ok("http://example.com/cake.png")).toBe(true);
  });

  it("ignores whitespace from copying", () => {
    expect(ok("  https://example.com/cake.jpg  ")).toBe(true);
  });
});

describe("things that are not a usable link", () => {
  it("rejects an empty box", () => {
    expect(errorFor("")).toMatch(/paste an image link/i);
  });

  it("rejects text that is not a link at all", () => {
    expect(errorFor("chocolate cake photo")).toMatch(/does not look like a link/i);
  });

  it("rejects other protocols", () => {
    expect(errorFor("file:///C:/Users/poterala/secret.png")).toMatch(/only https/i);
    expect(errorFor("ftp://example.com/cake.jpg")).toMatch(/only https/i);
  });

  // The single most common mistake: copying the address bar while looking at
  // Google Images, which is a page of results, not a picture.
  it("explains that a Google results page is not an image", () => {
    const message = errorFor("https://www.google.com/search?q=chocolate+cake&tbm=isch");
    expect(message).toMatch(/search results page/i);
    expect(message).toMatch(/copy image address/i);
  });

  it("still accepts a real image hosted on a Google domain", () => {
    expect(ok("https://lh3.googleusercontent.com/abc123=w800")).toBe(true);
  });
});

/**
 * The server fetches whatever address is typed here. These are the addresses
 * that are only reachable from inside — a link to one is either a mistake or
 * an attempt to make the server read something it should not.
 */
describe("addresses the server must refuse to fetch", () => {
  it.each([
    ["http://localhost:3000/api/v1/menu", "localhost"],
    ["http://127.0.0.1:5432/", "loopback"],
    ["http://0.0.0.0/", "this network"],
    ["http://[::1]/photo.png", "IPv6 loopback"],
    ["http://10.0.0.5/photo.jpg", "private 10.x"],
    ["http://192.168.0.109:3000/photo.jpg", "private 192.168.x"],
    ["http://172.16.4.2/photo.jpg", "private 172.16-31.x"],
    ["http://169.254.169.254/latest/meta-data/", "cloud metadata"],
    ["http://100.64.0.1/photo.jpg", "carrier-grade NAT"],
    ["http://db.internal/photo.jpg", ".internal"],
    ["http://printer.local/photo.jpg", ".local"],
  ])("refuses %s (%s)", (raw) => {
    expect(errorFor(raw)).toMatch(/private address/i);
  });

  it("allows a public address in a range next to a private one", () => {
    // 172.32.x is public; only 172.16-31 is private.
    expect(ok("http://172.32.0.1/photo.jpg")).toBe(true);
    // 192.167.x is public; only 192.168 is private.
    expect(ok("http://192.167.0.1/photo.jpg")).toBe(true);
  });
});

describe("isAcceptableImageType", () => {
  it.each(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"])(
    "accepts %s",
    (type) => {
      expect(isAcceptableImageType(type)).toBe(true);
    },
  );

  it("accepts a type with a charset appended, as servers often send", () => {
    expect(isAcceptableImageType("image/jpeg; charset=binary")).toBe(true);
  });

  it("rejects a web page, which is what a wrong link returns", () => {
    expect(isAcceptableImageType("text/html; charset=utf-8")).toBe(false);
  });

  it("rejects SVG, which can carry scripts", () => {
    expect(isAcceptableImageType("image/svg+xml")).toBe(false);
  });

  it("rejects a missing type", () => {
    expect(isAcceptableImageType(null)).toBe(false);
  });
});

const USER_LINKS = {
  gstatic:
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTNszRMeT9xh9ThlTYssKgc20JbRn_YJBqI3BQA0KPAUw&s=10",
  direct:
    "https://floursandfrostings.com/wp-content/uploads/2018/03/IMG_20180306_084523_451.jpg",
  share: "https://share.google/U86ksfehQYOUGe4jR",
  imgres:
    "https://www.google.com/imgres?q=cheese%20veg%20puff&imgurl=https%3A%2F%2Ffloursandfrostings.com%2Fwp-content%2Fuploads%2F2018%2F03%2FIMG_20180306_084523_451.jpg&imgrefurl=https%3A%2F%2Fexample.com",
};

describe("the links the owner actually pasted", () => {
  it("accepts the gstatic thumbnail (no file extension)", () => {
    expect(checkImageUrl(USER_LINKS.gstatic).ok).toBe(true);
  });

  it("accepts a direct .jpg", () => {
    expect(checkImageUrl(USER_LINKS.direct).ok).toBe(true);
  });

  it("recognises share.google as a short link needing a redirect", () => {
    const checked = checkImageUrl(USER_LINKS.share);
    expect(checked.ok).toBe(true);
    if (checked.ok) expect(isShortLink(checked.url)).toBe(true);
  });

  it("pulls the real picture out of a google.com/imgres link", () => {
    const checked = checkImageUrl(USER_LINKS.imgres);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;

    const inner = unwrapGoogleImageUrl(checked.url);
    expect(inner?.toString()).toBe(USER_LINKS.direct);
  });

  // Unwrapping must not become a way past the address check.
  it("re-checks the unwrapped address instead of trusting it", () => {
    const sneaky =
      "https://www.google.com/imgres?imgurl=" +
      encodeURIComponent("http://169.254.169.254/latest/meta-data/");
    const checked = checkImageUrl(sneaky);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;

    const inner = unwrapGoogleImageUrl(checked.url)!;
    expect(checkImageUrl(inner.toString()).ok).toBe(false);
  });
});

describe("unwrapGoogleImageUrl with a malformed wrapper", () => {
  it("returns null when imgurl is not a usable address", () => {
    const url = new URL("https://www.google.com/imgres?imgurl=not%20a%20url");
    expect(unwrapGoogleImageUrl(url)).toBeNull();
  });

  it("returns null when imgurl is missing altogether", () => {
    expect(unwrapGoogleImageUrl(new URL("https://www.google.com/imgres?q=cake"))).toBeNull();
  });

  it("returns null for a Google page that is not imgres", () => {
    expect(unwrapGoogleImageUrl(new URL("https://www.google.com/maps"))).toBeNull();
  });

  it("returns null for a non-Google host that happens to use /imgres", () => {
    expect(
      unwrapGoogleImageUrl(new URL("https://notgoogle.example/imgres?imgurl=https://a/b.jpg")),
    ).toBeNull();
  });
});
