import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The public JSON API, with the database replaced.
 *
 * These endpoints are what anything built on this menu reads, so the contract
 * matters: a hidden category must never leak through any of them, paging has to
 * agree with the totals it reports, and the health check has to actually fail
 * when the database is unreachable rather than cheerfully saying "ok".
 */

const { prisma } = vi.hoisted(() => ({
  prisma: {
    category: { count: vi.fn(), findMany: vi.fn() },
    item: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    setting: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma }));

const { GET: getCategories } = await import("./categories/route");
const { GET: getHealth } = await import("./health/route");
const { GET: getItems } = await import("./items/route");
const { GET: getItem } = await import("./items/[id]/route");
const { GET: getMenu } = await import("./menu/route");
const { GET: getShop } = await import("./shop/route");
const { GET: getSpec } = await import("./openapi.yaml/route");

const category = {
  id: "c1",
  name: "Cakes",
  slug: "cakes",
  description: "Fresh every morning",
  isVisible: true,
};

const item = {
  id: "i1",
  name: "Choco Truffle",
  description: "Rich Belgian chocolate.",
  price: 650,
  unit: "per kg",
  imageUrl: "/uploads/cake.jpg",
  isVeg: true,
  isEggless: false,
  isBestseller: true,
  isAvailable: true,
  variants: [{ id: "v1", label: "500 g", price: 350, sortOrder: 0 }],
  category,
};

function request(url: string) {
  return new Request(`http://localhost${url}`);
}

/** The `where` the handler asked Prisma for, on its first call. */
function whereOf(mock: { mock: { calls: unknown[][] } }) {
  return (mock.mock.calls[0][0] as { where: Record<string, unknown> }).where;
}

beforeEach(() => {
  prisma.category.count.mockResolvedValue(0);
  prisma.category.findMany.mockResolvedValue([]);
  prisma.item.count.mockResolvedValue(0);
  prisma.item.findMany.mockResolvedValue([]);
  prisma.item.findUnique.mockResolvedValue(null);
  prisma.setting.findMany.mockResolvedValue([]);
  prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/v1/health", () => {
  it("reports ok when the database answers", async () => {
    const response = await getHealth();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.version).toBe("1.0.0");
    expect(Date.parse(body.checkedAt)).not.toBeNaN();
  });

  // A health check that only proves the process is running would have stayed
  // green through the outage this endpoint exists to catch.
  it("reports 503 when the database cannot be reached", async () => {
    prisma.$queryRaw.mockRejectedValue(new Error("connection refused"));

    const response = await getHealth();

    expect(response.status).toBe(503);
    expect((await response.json()).status).toBe("error");
  });
});

describe("GET /api/v1/categories", () => {
  beforeEach(() => {
    prisma.category.count.mockResolvedValue(1);
    prisma.category.findMany.mockResolvedValue([{ ...category, _count: { items: 4 } }]);
  });

  it("returns each category with how many items it holds", async () => {
    const body = await (await getCategories(request("/api/v1/categories"))).json();

    expect(body.data).toEqual([
      {
        id: "c1",
        name: "Cakes",
        slug: "cakes",
        description: "Fresh every morning",
        itemCount: 4,
      },
    ]);
  });

  // Hidden is hidden: the API is as public as the menu page.
  it("asks only for the visible ones", async () => {
    await getCategories(request("/api/v1/categories"));
    expect(whereOf(prisma.category.findMany)).toEqual({ isVisible: true });
  });

  it("reports the paging alongside the data", async () => {
    prisma.category.count.mockResolvedValue(45);

    const body = await (await getCategories(request("/api/v1/categories?page=2&limit=20"))).json();

    expect(body.meta).toMatchObject({ page: 2, limit: 20, total: 45 });
    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20 }),
    );
  });

  it("keeps them in the order customers see", async () => {
    await getCategories(request("/api/v1/categories"));

    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    );
  });
});

describe("GET /api/v1/items", () => {
  beforeEach(() => {
    prisma.item.count.mockResolvedValue(1);
    prisma.item.findMany.mockResolvedValue([item]);
  });

  it("returns the items with their sizes", async () => {
    const body = await (await getItems(request("/api/v1/items"))).json();

    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ id: "i1", name: "Choco Truffle", price: 650 });
    expect(body.data[0].variants).toEqual([{ id: "v1", label: "500 g", price: 350 }]);
  });

  it("never reaches into a hidden category", async () => {
    await getItems(request("/api/v1/items"));
    expect(whereOf(prisma.item.findMany).category).toMatchObject({ isVisible: true });
  });

  it("narrows to one category by slug", async () => {
    await getItems(request("/api/v1/items?category=cakes"));
    expect(whereOf(prisma.item.findMany).category).toMatchObject({
      isVisible: true,
      slug: "cakes",
    });
  });

  it("ignores a blank category filter", async () => {
    await getItems(request("/api/v1/items?category=%20%20"));
    expect(whereOf(prisma.item.findMany).category).toEqual({ isVisible: true });
  });

  // A sold-out item is still on the menu, so it is returned unless excluded.
  it("returns sold-out items by default", async () => {
    await getItems(request("/api/v1/items"));
    expect(whereOf(prisma.item.findMany)).not.toHaveProperty("isAvailable");
  });

  it.each([
    ["true", true],
    ["false", false],
  ])("filters on available=%s", async (value, expected) => {
    await getItems(request(`/api/v1/items?available=${value}`));
    expect(whereOf(prisma.item.findMany).isAvailable).toBe(expected);
  });

  it("ignores an available filter that is neither", async () => {
    await getItems(request("/api/v1/items?available=maybe"));
    expect(whereOf(prisma.item.findMany)).not.toHaveProperty("isAvailable");
  });

  it("searches the name and the description", async () => {
    await getItems(request("/api/v1/items?q=chocolate"));

    expect(whereOf(prisma.item.findMany).OR).toEqual([
      { name: { contains: "chocolate" } },
      { description: { contains: "chocolate" } },
    ]);
  });

  it("ignores a blank search", async () => {
    await getItems(request("/api/v1/items?q=%20"));
    expect(whereOf(prisma.item.findMany)).not.toHaveProperty("OR");
  });

  it("combines the filters rather than letting one win", async () => {
    await getItems(request("/api/v1/items?category=cakes&available=true&q=choco"));

    const where = whereOf(prisma.item.findMany);
    expect(where.category).toMatchObject({ slug: "cakes", isVisible: true });
    expect(where.isAvailable).toBe(true);
    expect(where.OR).toBeDefined();
  });

  it("counts against the same filters it lists by", async () => {
    await getItems(request("/api/v1/items?category=cakes"));

    expect(whereOf(prisma.item.count)).toEqual(whereOf(prisma.item.findMany));
  });
});

describe("GET /api/v1/items/:id", () => {
  it("returns the item", async () => {
    prisma.item.findUnique.mockResolvedValue(item);

    const response = await getItem(request("/api/v1/items/i1"), {
      params: Promise.resolve({ id: "i1" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "i1", name: "Choco Truffle" });
  });

  it("returns a 404 with a code for an id that is not there", async () => {
    const response = await getItem(request("/api/v1/items/nope"), {
      params: Promise.resolve({ id: "nope" }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("ITEM_NOT_FOUND");
    expect(body.error.message).toContain("nope");
  });

  // Fetching by id must not be a way around the category being hidden.
  it("refuses an item whose category is hidden", async () => {
    prisma.item.findUnique.mockResolvedValue({
      ...item,
      category: { ...category, isVisible: false },
    });

    const response = await getItem(request("/api/v1/items/i1"), {
      params: Promise.resolve({ id: "i1" }),
    });

    expect(response.status).toBe(404);
  });
});

describe("GET /api/v1/menu", () => {
  it("returns the shop and its categories in one call", async () => {
    prisma.category.findMany.mockResolvedValue([{ ...category, items: [item] }]);

    const body = await (await getMenu()).json();

    expect(body.shop).toBeDefined();
    expect(body.categories).toHaveLength(1);
    expect(body.categories[0]).toMatchObject({ id: "c1", name: "Cakes", slug: "cakes" });
    expect(body.categories[0].items[0]).toMatchObject({ id: "i1" });
  });

  it("asks only for the visible categories", async () => {
    await getMenu();
    expect(whereOf(prisma.category.findMany)).toEqual({ isVisible: true });
  });

  // An empty category is a heading with nothing under it — noise on the menu.
  it("leaves out a category with no items in it", async () => {
    prisma.category.findMany.mockResolvedValue([
      { ...category, items: [item] },
      { ...category, id: "c2", name: "Breads", slug: "breads", items: [] },
    ]);

    const body = await (await getMenu()).json();

    expect(body.categories.map((one: { slug: string }) => one.slug)).toEqual(["cakes"]);
  });
});

describe("GET /api/v1/shop", () => {
  it("returns the shop details", async () => {
    const response = await getShop();

    expect(response.status).toBe(200);
    expect(await response.json()).toHaveProperty("name");
  });
});

describe("GET /api/v1/openapi.yaml", () => {
  // Served from the file in git rather than a copy in code, so the document
  // under review is byte-for-byte the one Swagger renders.
  it("serves the spec as yaml", async () => {
    const response = await getSpec();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/yaml; charset=utf-8");
    expect(await response.text()).toContain("openapi:");
  });

  it("lets any tool fetch it", async () => {
    const response = await getSpec();
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("is never cached, so an edit shows up straight away", async () => {
    const response = await getSpec();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("says so plainly when the file is missing from the deployment", async () => {
    const cwd = vi.spyOn(process, "cwd").mockReturnValue("/nowhere-at-all");

    const response = await getSpec();

    expect(response.status).toBe(500);
    expect(await response.text()).toContain("missing from the deployment");
    cwd.mockRestore();
  });
});
