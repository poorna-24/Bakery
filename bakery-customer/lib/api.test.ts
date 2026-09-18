import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  apiError,
  buildMeta,
  json,
  readPagination,
  toApiItem,
} from "./api";

const params = (query: string) => new URLSearchParams(query);

describe("readPagination", () => {
  it("defaults to the first page", () => {
    expect(readPagination(params(""))).toEqual({ page: 1, limit: DEFAULT_LIMIT, skip: 0 });
  });

  it("reads a page and limit", () => {
    expect(readPagination(params("page=3&limit=10"))).toEqual({ page: 3, limit: 10, skip: 20 });
  });

  it("caps the limit, so nobody can ask for the whole database at once", () => {
    expect(readPagination(params("limit=100000")).limit).toBe(MAX_LIMIT);
  });

  // A fumbled query string should still return the first page, not a 500.
  it.each(["page=abc", "page=0", "page=-4", "page=1.5", "page="])(
    "falls back to page 1 for ?%s",
    (query) => {
      expect(readPagination(params(query)).page).toBe(1);
    },
  );

  it.each(["limit=abc", "limit=0", "limit=-10", "limit="])(
    "falls back to the default limit for ?%s",
    (query) => {
      expect(readPagination(params(query)).limit).toBe(DEFAULT_LIMIT);
    },
  );

  it("never produces a negative skip", () => {
    expect(readPagination(params("page=-5")).skip).toBe(0);
  });
});

describe("buildMeta", () => {
  it("reports the totals for the whole result set, not just this page", () => {
    expect(buildMeta(23, { page: 1, limit: 10, skip: 0 })).toEqual({
      page: 1,
      limit: 10,
      total: 23,
      totalPages: 3,
    });
  });

  it("says one page when there is nothing, rather than zero pages", () => {
    expect(buildMeta(0, { page: 1, limit: 20, skip: 0 }).totalPages).toBe(1);
  });

  it("does not round a part-full last page away", () => {
    expect(buildMeta(21, { page: 1, limit: 20, skip: 0 }).totalPages).toBe(2);
  });
});

describe("toApiItem", () => {
  const row = {
    id: "i1",
    name: "Choco Truffle Cake",
    description: "Rich.",
    price: 650,
    unit: "per kg",
    imageUrl: "/uploads/a.jpg",
    isVeg: true,
    isEggless: false,
    isBestseller: true,
    isAvailable: true,
    categoryId: "c1",
    category: { slug: "cakes" },
    variants: [{ id: "v1", label: "1 kg", price: 650 }],
  };

  it("flattens the category slug onto the item", () => {
    expect(toApiItem(row)).toMatchObject({ categoryId: "c1", categorySlug: "cakes" });
  });

  it("keeps the variants", () => {
    expect(toApiItem(row).variants).toEqual([{ id: "v1", label: "1 kg", price: 650 }]);
  });

  // Whatever else the database row carries must not leak into a public response.
  it("returns only the documented fields", () => {
    const withSecret = { ...row, sortOrder: 3, createdAt: new Date(), internalNote: "secret" };
    expect(Object.keys(toApiItem(withSecret)).sort()).toEqual(
      [
        "categoryId",
        "categorySlug",
        "description",
        "id",
        "imageUrl",
        "isAvailable",
        "isBestseller",
        "isEggless",
        "isVeg",
        "name",
        "price",
        "unit",
        "variants",
      ].sort(),
    );
  });
});

describe("json", () => {
  it("sends JSON with CORS open, because the menu is public", async () => {
    const response = json({ hello: "world" });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    await expect(response.json()).resolves.toEqual({ hello: "world" });
  });

  // Prices and sold-out flags change during the day; a cached menu is worse
  // than a slow one.
  it("forbids caching", () => {
    expect(json({}).headers.get("Cache-Control")).toBe("no-store");
  });

  it("honours a custom status", () => {
    expect(json({}, 503).status).toBe(503);
  });
});

describe("apiError", () => {
  it("returns the documented error envelope", async () => {
    const response = apiError(404, "ITEM_NOT_FOUND", 'No item exists with id "x".');

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: "ITEM_NOT_FOUND", message: 'No item exists with id "x".' },
    });
  });
});
