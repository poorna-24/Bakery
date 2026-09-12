import { afterEach, describe, expect, it, vi } from "vitest";
import { backgroundClass, type BackgroundId } from "./backgrounds";
import { shopNow, shopStatus, type ShopHours } from "./hours";
import { offerToneClass, type OfferTone } from "./offer";
import { contentTypeFor, extensionFor, uploadsDir } from "./storage";

/**
 * The defensive branches — the `?? fallback` arms and guards that only run when
 * something upstream has gone wrong. Easy to leave untested precisely because
 * they should never fire, which is also what makes a quiet mistake in one of
 * them hard to spot.
 */

describe("fallbacks for an id that is not in the catalogue", () => {
  // A row left behind after an option was renamed, or a hand-edited form.
  it("returns no class for an unknown background rather than undefined", () => {
    expect(backgroundClass("nonsense" as BackgroundId)).toBe("");
  });

  it("falls back to the festive tone for an unknown offer colour", () => {
    expect(offerToneClass("rainbow" as OfferTone)).toBe("offer-festive");
  });
});

describe("shopStatus with times that cannot be parsed", () => {
  // Closed is the safe answer: better to send someone away than to promise
  // the shop is open when nobody actually knows.
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

describe("shopNow", () => {
  it("always returns a weekday and a time within the day", () => {
    const now = shopNow(new Date("2026-09-12T09:00:00Z"));
    expect(now.weekday).toBeGreaterThanOrEqual(0);
    expect(now.weekday).toBeLessThanOrEqual(6);
    expect(now.minutes).toBeGreaterThanOrEqual(0);
    expect(now.minutes).toBeLessThan(24 * 60);
  });

  it("treats the shop's midnight as the start of the day, not 24:00", () => {
    expect(shopNow(new Date("2026-09-11T18:30:00Z")).minutes).toBe(0);
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

  // Removing the variable must not move where photos are served from: the
  // default resolves to the same folder it used to name.
  it("falls back to ../data when it is not set", () => {
    delete process.env.BAKERY_DATA_DIR;
    expect(uploadsDir().replace(/\\/g, "/")).toMatch(/\/data\/uploads$/);
  });
});

describe("file type helpers", () => {
  it("round-trips every accepted type", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/avif"]) {
      expect(contentTypeFor(`file${extensionFor(type)}`)).toBe(type);
    }
  });

  it("falls back to jpeg for anything unrecognised", () => {
    expect(extensionFor("application/octet-stream")).toBe(".jpg");
    expect(contentTypeFor("file.unknown")).toBe("image/jpeg");
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
