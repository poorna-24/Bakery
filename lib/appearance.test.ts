import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({
  db: { findMany: vi.fn() },
}));
vi.mock("./db", () => ({ prisma: { setting: { findMany: db.findMany } } }));

const { loadAppearance } = await import("./appearance");
const { DEFAULT_APPEARANCE, SETTING_KEYS } = await import("./backgrounds");

beforeEach(() => {
  db.findMany.mockReset();
});

describe("loadAppearance", () => {
  it("returns the background chosen under Appearance", async () => {
    db.findMany.mockResolvedValue([
      { key: SETTING_KEYS.backgroundId, value: "custom" },
      { key: SETTING_KEYS.backgroundImageUrl, value: "/uploads/shop.jpg" },
    ]);

    expect(await loadAppearance()).toEqual({
      backgroundId: "custom",
      backgroundImageUrl: "/uploads/shop.jpg",
    });
  });

  it("asks only for the background settings", async () => {
    db.findMany.mockResolvedValue([]);
    await loadAppearance();

    expect(db.findMany).toHaveBeenCalledWith({
      where: { key: { in: [SETTING_KEYS.backgroundId, SETTING_KEYS.backgroundImageUrl] } },
    });
  });

  it("is plain before anything has been chosen", async () => {
    db.findMany.mockResolvedValue([]);
    expect(await loadAppearance()).toEqual(DEFAULT_APPEARANCE);
  });

  // The layout wraps the login page; losing the database must not lock the owner out.
  it("falls back to plain when the database cannot be reached", async () => {
    db.findMany.mockRejectedValue(new Error("connection refused"));
    expect(await loadAppearance()).toEqual(DEFAULT_APPEARANCE);
  });
});
