import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * getShop stitches together the two places the shop's details live: the
 * environment, for things set once at deploy time, and the settings table,
 * for the hours the owner changes from the admin.
 */

let settingRows: { key: string; value: string }[] = [];

vi.mock("@/lib/db", () => ({
  prisma: { setting: { findMany: async () => settingRows } },
}));

const { getShop } = await import("./shop");

const original = { ...process.env };

beforeEach(() => {
  settingRows = [];
  process.env.NEXT_PUBLIC_SHOP_NAME = "SHIVAM BAKERY";
  process.env.NEXT_PUBLIC_SHOP_TAGLINE = "Fresh every morning.";
  process.env.NEXT_PUBLIC_SHOP_ADDRESS = "Cherial, Telangana";
  process.env.NEXT_PUBLIC_SHOP_MAP_URL = "https://maps.example/shop";
  process.env.NEXT_PUBLIC_SHOP_PHONE = "+91 76660 93143";
  process.env.NEXT_PUBLIC_SHOP_WHATSAPP = "+917666093143";
});

afterEach(() => {
  process.env = { ...original };
});

describe("getShop", () => {
  it("reads the shop's details from the environment", async () => {
    const shop = await getShop();

    expect(shop).toMatchObject({
      name: "SHIVAM BAKERY",
      tagline: "Fresh every morning.",
      address: "Cherial, Telangana",
      mapUrl: "https://maps.example/shop",
      phone: "+91 76660 93143",
      whatsapp: "+917666093143",
    });
  });

  // A fresh clone with nothing configured should still render a page.
  it("falls back to safe defaults when nothing is configured", async () => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("NEXT_PUBLIC_SHOP_")) delete process.env[key];
    }

    const shop = await getShop();
    expect(shop.name).toBe("Our Bakery");
    expect(shop.tagline).toBe("");
    expect(shop.address).toBe("");
  });

  it("has no hours until the owner sets them", async () => {
    const shop = await getShop();
    expect(shop.hours).toBeNull();
    expect(shop.status).toBeNull();
  });

  it("works out whether the shop is open once hours exist", async () => {
    settingRows = [
      { key: "hours.open", value: "00:00" },
      { key: "hours.close", value: "23:59" },
    ];

    const shop = await getShop();
    expect(shop.hours).toEqual({ open: "00:00", close: "23:59", closedDays: [] });
    expect(shop.status?.isOpen).toBe(true);
  });

  it("reports closed on a weekly off day", async () => {
    // Every day off except one that is not today would be simpler, but the
    // point is that closedDays reaches the status calculation at all.
    settingRows = [
      { key: "hours.open", value: "00:00" },
      { key: "hours.close", value: "23:59" },
      { key: "hours.closedDays", value: "0,1,2,3,4,5,6" },
    ];

    const shop = await getShop();
    expect(shop.status?.isOpen).toBe(false);
  });

  it("ignores hours that are not times", async () => {
    settingRows = [
      { key: "hours.open", value: "morning" },
      { key: "hours.close", value: "night" },
    ];

    const shop = await getShop();
    expect(shop.hours).toBeNull();
  });
});
