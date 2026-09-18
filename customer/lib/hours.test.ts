import { describe, expect, it } from "vitest";
import {
  HOURS_KEYS,
  formatTime,
  isValidTime,
  shopNow,
  shopStatus,
  toMinutes,
  toShopHours,
  type ShopHours,
} from "./hours";

const daily: ShopHours = { open: "07:00", close: "21:00", closedDays: [] };
const at = (minutes: number, weekday = 3) => ({ minutes, weekday });

describe("isValidTime", () => {
  it("accepts 24-hour times", () => {
    expect(isValidTime("00:00")).toBe(true);
    expect(isValidTime("07:30")).toBe(true);
    expect(isValidTime("23:59")).toBe(true);
  });

  it("rejects anything a form should not have produced", () => {
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("7:00")).toBe(false);
    expect(isValidTime("07:60")).toBe(false);
    expect(isValidTime("")).toBe(false);
    expect(isValidTime("morning")).toBe(false);
  });
});

describe("toMinutes", () => {
  it("counts from midnight", () => {
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("07:30")).toBe(450);
    expect(toMinutes("23:59")).toBe(1439);
  });

  it("is null for an invalid time", () => {
    expect(toMinutes("nope")).toBeNull();
  });
});

describe("formatTime", () => {
  it("reads the way a customer expects", () => {
    expect(formatTime("07:00")).toBe("7:00 am");
    expect(formatTime("21:00")).toBe("9:00 pm");
    expect(formatTime("07:30")).toBe("7:30 am");
  });

  it("gets the two confusing ones right", () => {
    expect(formatTime("00:00")).toBe("12:00 am");
    expect(formatTime("12:00")).toBe("12:00 pm");
  });
});

describe("toShopHours", () => {
  it("is null when the owner has set nothing", () => {
    expect(toShopHours([])).toBeNull();
  });

  it("is null when only one end is set", () => {
    expect(toShopHours([{ key: HOURS_KEYS.open, value: "07:00" }])).toBeNull();
  });

  it("is null for a stored value that is not a time", () => {
    expect(
      toShopHours([
        { key: HOURS_KEYS.open, value: "early" },
        { key: HOURS_KEYS.close, value: "21:00" },
      ]),
    ).toBeNull();
  });

  it("reads open and close", () => {
    expect(
      toShopHours([
        { key: HOURS_KEYS.open, value: "07:00" },
        { key: HOURS_KEYS.close, value: "21:00" },
      ]),
    ).toEqual({ open: "07:00", close: "21:00", closedDays: [] });
  });

  it("reads the weekly off days, ignoring junk and duplicates", () => {
    expect(
      toShopHours([
        { key: HOURS_KEYS.open, value: "07:00" },
        { key: HOURS_KEYS.close, value: "21:00" },
        { key: HOURS_KEYS.closedDays, value: "2, 9, 2, x, 0" },
      ])?.closedDays,
    ).toEqual([0, 2]);
  });
});

describe("shopStatus during normal hours", () => {
  it("is open in the middle of the day", () => {
    expect(shopStatus(daily, at(12 * 60))).toMatchObject({ isOpen: true, label: "Open now" });
  });

  it("is open exactly at opening time", () => {
    expect(shopStatus(daily, at(7 * 60)).isOpen).toBe(true);
  });

  it("is closed exactly at closing time", () => {
    // 9pm sharp means the shutters are down, not one last sale.
    expect(shopStatus(daily, at(21 * 60)).isOpen).toBe(false);
  });

  it("is closed before opening, and says when it opens", () => {
    expect(shopStatus(daily, at(6 * 60))).toMatchObject({
      isOpen: false,
      detail: "Opens 7:00 am",
    });
  });

  it("shows the range once the shop has shut for the day", () => {
    expect(shopStatus(daily, at(22 * 60))).toMatchObject({
      isOpen: false,
      detail: "7:00 am – 9:00 pm",
    });
  });
});

describe("shopStatus with a weekly off", () => {
  const closedSundays: ShopHours = { ...daily, closedDays: [0] };

  it("is closed all day on the off day", () => {
    expect(shopStatus(closedSundays, at(12 * 60, 0))).toMatchObject({
      isOpen: false,
      detail: "Closed today",
    });
  });

  it("is open as usual on other days", () => {
    expect(shopStatus(closedSundays, at(12 * 60, 1)).isOpen).toBe(true);
  });
});

describe("shopStatus for a shop that runs past midnight", () => {
  const late: ShopHours = { open: "18:00", close: "02:00", closedDays: [] };

  it("is open in the evening", () => {
    expect(shopStatus(late, at(20 * 60)).isOpen).toBe(true);
  });

  it("is still open after midnight", () => {
    expect(shopStatus(late, at(1 * 60)).isOpen).toBe(true);
  });

  it("is closed in the afternoon", () => {
    expect(shopStatus(late, at(15 * 60)).isOpen).toBe(false);
  });

  it("is closed at closing time", () => {
    expect(shopStatus(late, at(2 * 60)).isOpen).toBe(false);
  });

  // 1am on Monday belongs to Sunday's shift, so a Sunday closure covers it.
  it("counts the small hours against the day the shift started", () => {
    const closedSundays: ShopHours = { ...late, closedDays: [0] };
    expect(shopStatus(closedSundays, at(1 * 60, 1)).isOpen).toBe(false);
    expect(shopStatus(closedSundays, at(20 * 60, 1)).isOpen).toBe(true);
  });
});

describe("shopStatus for a shop open around the clock", () => {
  const always: ShopHours = { open: "00:00", close: "00:00", closedDays: [] };

  it("is always open", () => {
    expect(shopStatus(always, at(3 * 60))).toMatchObject({
      isOpen: true,
      detail: "Open 24 hours",
    });
  });

  it("still honours the weekly off", () => {
    expect(shopStatus({ ...always, closedDays: [2] }, at(3 * 60, 2)).isOpen).toBe(false);
  });
});

describe("shopNow", () => {
  // The whole point: the shop's clock, not the server's.
  it("reads the time in the shop's timezone, not UTC", () => {
    // 2026-09-09T18:30:00Z is midnight on the 10th in Kolkata (UTC+5:30).
    const now = shopNow(new Date("2026-09-09T18:30:00Z"));
    expect(now.minutes).toBe(0);
  });

  it("rolls the weekday over with the shop's midnight", () => {
    // 18:29Z on Wednesday is still 23:59 Wednesday in Kolkata.
    expect(shopNow(new Date("2026-09-09T18:29:00Z")).weekday).toBe(3);
    // One minute later it is Thursday there.
    expect(shopNow(new Date("2026-09-09T18:30:00Z")).weekday).toBe(4);
  });

  it("gives a sane time of day for a working afternoon", () => {
    // 09:00Z = 14:30 in Kolkata.
    expect(shopNow(new Date("2026-09-09T09:00:00Z")).minutes).toBe(14 * 60 + 30);
  });
});
