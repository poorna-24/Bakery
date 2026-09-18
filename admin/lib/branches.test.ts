import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkImageUrl } from "./imageUrl";
import { publicIdFromUrl } from "./cloudinary";
import { verifyToken } from "./auth";
import { shopNow } from "./hours";
import { checkCredentials } from "./auth";

/**
 * The last few conditional arms. Most are guards against input that should
 * never arrive — which is exactly why they are worth a test: nothing else
 * would notice if one of them stopped working.
 */

describe("address forms that hide a private target", () => {
  // Someone reaching for an internal service is unlikely to type 127.0.0.1.
  // These are the shapes that look unfamiliar enough to slip past a reader.
  it.each([
    ["http://[fd00::1]/photo.jpg", "IPv6 unique-local fd00::/8"],
    ["http://[fc00::1]/photo.jpg", "IPv6 unique-local fc00::/8"],
    ["http://[::ffff:127.0.0.1]/photo.jpg", "IPv4 loopback mapped into IPv6"],
    ["http://[::ffff:192.168.1.1]/photo.jpg", "private IPv4 mapped into IPv6"],
    ["http://[::]/photo.jpg", "the unspecified address"],
    ["http://239.255.255.250/photo.jpg", "multicast"],
    ["http://255.255.255.255/photo.jpg", "broadcast"],
  ])("refuses %s (%s)", (raw) => {
    const result = checkImageUrl(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/private address/i);
  });

  // An octet above 255 is not a real address. The URL parser refuses to build
  // one at all, so this never even reaches the private-address check — but it
  // is refused either way, which is what matters.
  it("refuses an address with an impossible octet", () => {
    expect(checkImageUrl("http://999.1.1.1/photo.jpg").ok).toBe(false);
  });

  it("still allows an ordinary public IPv6 host", () => {
    expect(checkImageUrl("http://[2606:4700::1111]/photo.jpg").ok).toBe(true);
  });
});

describe("publicIdFromUrl with unusual paths", () => {
  it("handles a delivery url with no version segment", () => {
    expect(publicIdFromUrl("https://res.cloudinary.com/c/image/upload/bakery/abc.jpg")).toBe(
      "bakery/abc",
    );
  });

  it("returns null when nothing follows the transformations", () => {
    expect(publicIdFromUrl("https://res.cloudinary.com/c/image/upload/f_auto/v1/")).toBeNull();
  });

  it("keeps an id that has no file extension", () => {
    expect(publicIdFromUrl("https://res.cloudinary.com/c/image/upload/v1/bakery/abc")).toBe(
      "bakery/abc",
    );
  });
});

describe("shopNow in an unusual locale", () => {
  it("handles midnight in the shop's timezone without wrapping past the day", () => {
    // 18:30Z is exactly midnight in Asia/Kolkata.
    expect(shopNow(new Date("2026-09-11T18:30:00Z")).minutes).toBe(0);
  });
});

describe("checkCredentials when the environment is incomplete", () => {
  const original = { ...process.env };

  beforeEach(() => {
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_PASSWORD_HASH;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  // With nothing configured, an empty email must not match an empty input.
  it("refuses an empty email when ADMIN_EMAIL is unset", async () => {
    process.env.ADMIN_PASSWORD = "something";
    expect(await checkCredentials("", "something")).toBe(false);
  });

  it("refuses any login when no password is configured at all", async () => {
    process.env.ADMIN_EMAIL = "owner@bakery.com";
    expect(await checkCredentials("owner@bakery.com", "")).toBe(false);
    expect(await checkCredentials("owner@bakery.com", "guess")).toBe(false);
  });
});

describe("shopNow when the runtime formats dates unexpectedly", () => {
  /** Stands in for a runtime whose Intl output does not match our assumptions. */
  function formattingAs(parts: { type: string; value: string }[]) {
    return vi
      .spyOn(Intl.DateTimeFormat.prototype, "formatToParts")
      .mockReturnValue(parts as Intl.DateTimeFormatPart[]);
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // The weekday is matched against short English names. Somewhere that spells
  // them differently, the date's own weekday keeps the badge roughly right
  // rather than leaving it on -1 and hiding the shop's hours entirely.
  it("falls back to the date's own weekday when the name is not recognised", () => {
    formattingAs([
      { type: "hour", value: "09" },
      { type: "minute", value: "30" },
      { type: "weekday", value: "sáb" },
    ]);

    const at = new Date("2026-09-12T09:00:00Z");
    expect(shopNow(at)).toEqual({ minutes: 570, weekday: at.getDay() });
  });

  it("treats a part that is missing altogether as absent rather than NaN", () => {
    formattingAs([{ type: "minute", value: "30" }]);

    const at = new Date("2026-09-12T09:00:00Z");
    expect(shopNow(at)).toEqual({ minutes: 30, weekday: at.getDay() });
  });
});

describe("a session token that is signed but wrong inside", () => {
  const original = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = "a-secret-long-enough-to-use";
  });

  afterEach(() => {
    if (original === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = original;
  });

  // Our own signing key, but a claim that is not the shape we issue. Trusting
  // it would put a number where the rest of the code expects an address.
  it("refuses a token whose email claim is not an address", async () => {
    const { SignJWT } = await import("jose");
    const key = new TextEncoder().encode(process.env.SESSION_SECRET);

    const token = await new SignJWT({ email: 12345 })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(key);

    expect(await verifyToken(token)).toBeNull();
  });

  it("refuses a token carrying no email at all", async () => {
    const { SignJWT } = await import("jose");
    const key = new TextEncoder().encode(process.env.SESSION_SECRET);

    const token = await new SignJWT({ sub: "someone" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(key);

    expect(await verifyToken(token)).toBeNull();
  });
});

describe("publicIdFromUrl at the ends of the path", () => {
  // A version segment with nothing after it names no picture at all.
  it("returns null when the address stops at the version", () => {
    expect(publicIdFromUrl("https://res.cloudinary.com/c/image/upload/f_auto/v1")).toBeNull();
  });

  it("returns null when there is nothing after the upload segment", () => {
    expect(publicIdFromUrl("https://res.cloudinary.com/c/image/upload/")).toBeNull();
  });

  it("returns null for an address with no upload segment in it", () => {
    expect(publicIdFromUrl("https://res.cloudinary.com/c/image/fetch/v1/bakery/a.jpg")).toBeNull();
  });
});
