import { afterEach, describe, expect, it } from "vitest";
import { backgroundClass, type BackgroundId } from "./backgrounds";
import { shopStatus, type ShopHours } from "./hours";
import { unwrapGoogleImageUrl } from "./imageUrl";
import { offerToneClass, type OfferTone } from "./offer";
import { uploadsDir } from "./storage";

/**
 * The defensive branches — the `?? fallback` arms and the guards that only run
 * when something upstream has gone wrong. They are easy to leave untested
 * precisely because they should never fire, which is also what makes a silent
 * mistake in one of them hard to notice.
 */

describe("fallbacks for an id that is not in the catalogue", () => {
  // A hand-edited form, or a row left behind after an option was renamed.
  it("returns no class for an unknown background rather than an undefined one", () => {
    expect(backgroundClass("nonsense" as BackgroundId)).toBe("");
  });

  it("falls back to the festive tone for an unknown offer colour", () => {
    expect(offerToneClass("rainbow" as OfferTone)).toBe("offer-festive");
  });
});

describe("shopStatus with times that cannot be parsed", () => {
  // toShopHours normally rejects these, but shopStatus is exported and takes
  // whatever it is handed. Closed is the safe answer: better to send someone
  // away than to promise the shop is open when nobody knows.
  it("reports closed when the stored times are not times", () => {
    const broken = { open: "morning", close: "evening", closedDays: [] } as unknown as ShopHours;

    expect(shopStatus(broken, { minutes: 600, weekday: 3 })).toMatchObject({
      isOpen: false,
      label: "Closed",
    });
  });

  it("reports closed when only one end is unparseable", () => {
    const half = { open: "07:00", close: "later", closedDays: [] } as unknown as ShopHours;
    expect(shopStatus(half, { minutes: 600, weekday: 3 }).isOpen).toBe(false);
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

describe("uploadsDir", () => {
  const original = process.env.BAKERY_DATA_DIR;

  afterEach(() => {
    if (original === undefined) delete process.env.BAKERY_DATA_DIR;
    else process.env.BAKERY_DATA_DIR = original;
  });

  it("uses BAKERY_DATA_DIR when it is set", () => {
    process.env.BAKERY_DATA_DIR = "/tmp/bakery-data";
    expect(uploadsDir().replace(/\\/g, "/")).toMatch(/bakery-data\/uploads$/);
  });

  // Removing the variable must not change where photos live: the default
  // resolves to the same folder it used to name.
  it("falls back to ../data when it is not set", () => {
    delete process.env.BAKERY_DATA_DIR;
    expect(uploadsDir().replace(/\\/g, "/")).toMatch(/\/data\/uploads$/);
  });
});
