import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Every mutation the owner can perform, with the database and the image store
 * replaced. What is worth pinning here is not the SQL — Prisma's job — but the
 * decisions around it: which input is refused outright, when an old photo gets
 * cleared off the store, and where the owner is sent afterwards.
 */

const { prisma } = vi.hoisted(() => ({
  prisma: {
    category: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    item: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    itemVariant: { deleteMany: vi.fn() },
    setting: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    order: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const { images } = vi.hoisted(() => ({
  images: { saveImage: vi.fn(), saveImageFromUrl: vi.fn(), deleteImage: vi.fn() },
}));

const revalidatePath = vi.fn();

/**
 * The real redirect() throws, and several actions lean on that to stop before
 * they write anything. A mock that merely returned would let those carry on.
 */
class Redirected extends Error {
  constructor(readonly to: string) {
    super(`redirect to ${to}`);
  }
}

/** The session check every action starts with; signed in unless a test says otherwise. */
const { auth } = vi.hoisted(() => ({ auth: { requireAdmin: vi.fn() } }));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/saveImage", () => images);
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirected(to);
  },
}));

const actions = await import("./actions");

/** Runs an action expected to end in a redirect and returns where it went. */
async function redirectTo(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    if (error instanceof Redirected) return error.to;
    throw error;
  }
  throw new Error("expected the action to redirect, but it returned normally");
}

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const one of Array.isArray(value) ? value : [value]) data.append(key, one);
  }
  return data;
}

/** A form carrying a chosen file, the way the browser sends one. */
function withFile(fields: Record<string, string | string[]>, bytes = 3): FormData {
  const data = form(fields);
  data.append("image", new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }), "cake.jpg");
  return data;
}

beforeEach(() => {
  auth.requireAdmin.mockResolvedValue("owner@bakery.com");
  // Sensible "nothing there yet" answers; each test overrides what it needs.
  prisma.category.findUnique.mockResolvedValue(null);
  prisma.category.findFirst.mockResolvedValue(null);
  prisma.category.findMany.mockResolvedValue([]);
  prisma.item.findUnique.mockResolvedValue(null);
  prisma.item.findFirst.mockResolvedValue(null);
  prisma.item.findMany.mockResolvedValue([]);
  prisma.setting.findUnique.mockResolvedValue(null);
  prisma.$transaction.mockImplementation(async (operations: unknown) => operations);
  images.saveImage.mockResolvedValue(null);
  images.saveImageFromUrl.mockResolvedValue(null);
  images.deleteImage.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ------------------------------------------------------------------ categories

describe("createCategory", () => {
  it("saves the name, description and a slug", async () => {
    await actions.createCategory(form({ name: "  Cakes  ", description: " Fresh daily " }));

    expect(prisma.category.create).toHaveBeenCalledWith({
      data: { name: "Cakes", slug: "cakes", description: "Fresh daily", sortOrder: 1 },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("does nothing at all when the name is blank", async () => {
    await actions.createCategory(form({ name: "   " }));

    expect(prisma.category.create).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("puts the new category after the last one", async () => {
    prisma.category.findFirst.mockResolvedValue({ sortOrder: 7 });

    await actions.createCategory(form({ name: "Breads" }));

    expect(prisma.category.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sortOrder: 8 }) }),
    );
  });

  // Two categories with the same slug would collide on the customer's menu.
  it("numbers a slug that is already taken", async () => {
    prisma.category.findUnique
      .mockResolvedValueOnce({ id: "other", slug: "cakes" })
      .mockResolvedValueOnce({ id: "another", slug: "cakes-2" })
      .mockResolvedValueOnce(null);

    await actions.createCategory(form({ name: "Cakes" }));

    expect(prisma.category.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: "cakes-3" }) }),
    );
  });

  // "🎂🎂🎂" slugifies to nothing, and an empty slug is not a usable address.
  it("falls back to a usable slug when the name has no letters in it", async () => {
    await actions.createCategory(form({ name: "🎂🎂🎂" }));

    expect(prisma.category.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: "category" }) }),
    );
  });
});

describe("updateCategory", () => {
  it("renames it and refreshes both the menu and its own page", async () => {
    await actions.updateCategory(form({ id: "c1", name: "Cakes & Bakes", description: "" }));

    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { name: "Cakes & Bakes", slug: "cakes-and-bakes", description: "" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/categories/c1");
  });

  // Renaming a category must not make its own slug look taken.
  it("keeps its existing slug rather than numbering it against itself", async () => {
    prisma.category.findUnique.mockResolvedValue({ id: "c1", slug: "cakes" });

    await actions.updateCategory(form({ id: "c1", name: "Cakes" }));

    expect(prisma.category.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: "cakes" }) }),
    );
  });

  it.each([
    ["no id", { id: "", name: "Cakes" }],
    ["no name", { id: "c1", name: "  " }],
  ])("does nothing with %s", async (_case, fields) => {
    await actions.updateCategory(form(fields));
    expect(prisma.category.update).not.toHaveBeenCalled();
  });
});

describe("toggleCategoryVisible", () => {
  it("flips a visible category to hidden", async () => {
    prisma.category.findUnique.mockResolvedValue({ id: "c1", isVisible: true });

    await actions.toggleCategoryVisible(form({ id: "c1" }));

    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { isVisible: false },
    });
  });

  it("flips a hidden one back", async () => {
    prisma.category.findUnique.mockResolvedValue({ id: "c1", isVisible: false });

    await actions.toggleCategoryVisible(form({ id: "c1" }));

    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { isVisible: true },
    });
  });

  it("does nothing for a category that is not there", async () => {
    await actions.toggleCategoryVisible(form({ id: "gone" }));
    expect(prisma.category.update).not.toHaveBeenCalled();
  });
});

describe("moveCategory", () => {
  const three = [
    { id: "a", sortOrder: 0 },
    { id: "b", sortOrder: 1 },
    { id: "c", sortOrder: 2 },
  ];

  beforeEach(() => {
    prisma.category.findMany.mockResolvedValue(three);
  });

  it("swaps places with the one above", async () => {
    await actions.moveCategory(form({ id: "b", direction: "up" }));

    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: "b" },
      data: { sortOrder: 0 },
    });
    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: "a" },
      data: { sortOrder: 1 },
    });
  });

  it("swaps places with the one below", async () => {
    await actions.moveCategory(form({ id: "b", direction: "down" }));

    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: "b" },
      data: { sortOrder: 2 },
    });
  });

  it.each([
    ["the first one up", { id: "a", direction: "up" }],
    ["the last one down", { id: "c", direction: "down" }],
    ["one that is not in the list", { id: "zzz", direction: "up" }],
  ])("refuses to move %s", async (_case, fields) => {
    await actions.moveCategory(form(fields));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("deleteCategory", () => {
  it("hands the items to another category when one is chosen", async () => {
    const to = await redirectTo(() =>
      actions.deleteCategory(form({ id: "c1", moveTo: "c2" })),
    );

    expect(prisma.item.updateMany).toHaveBeenCalledWith({
      where: { categoryId: "c1" },
      data: { categoryId: "c2" },
    });
    expect(images.deleteImage).not.toHaveBeenCalled();
    expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
    expect(to).toBe("/");
  });

  // Deleting the items without their photos would leave the store filling up
  // with files nothing points at any more.
  it("clears the photos of the items it deletes with it", async () => {
    prisma.item.findMany.mockResolvedValue([
      { id: "i1", imageUrl: "https://res.cloudinary.com/c/a.jpg" },
      { id: "i2", imageUrl: null },
    ]);

    await redirectTo(() => actions.deleteCategory(form({ id: "c1", moveTo: "" })));

    expect(images.deleteImage).toHaveBeenCalledTimes(2);
    expect(images.deleteImage).toHaveBeenCalledWith("https://res.cloudinary.com/c/a.jpg");
    expect(prisma.item.updateMany).not.toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------------- items

describe("createItem", () => {
  const base = { categoryId: "c1", name: "Choco Truffle", price: "650", unit: "per kg" };

  it("saves the item and returns to its category", async () => {
    const to = await redirectTo(() => actions.createItem(form(base)));

    expect(prisma.item.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        categoryId: "c1",
        name: "Choco Truffle",
        price: 650,
        unit: "per kg",
        imageUrl: null,
        isVeg: false,
        isEggless: false,
        isBestseller: false,
        isAvailable: false,
        sortOrder: 1,
      }),
    });
    expect(to).toBe("/admin/categories/c1");
  });

  it.each([
    ["no category", { ...base, categoryId: "" }],
    ["no name", { ...base, name: " " }],
  ])("does nothing with %s", async (_case, fields) => {
    await actions.createItem(form(fields));
    expect(prisma.item.create).not.toHaveBeenCalled();
  });

  it("records the tick boxes the owner checked", async () => {
    await redirectTo(() =>
      actions.createItem(
        form({ ...base, isVeg: "on", isEggless: "on", isBestseller: "on", isAvailable: "on" }),
      ),
    );

    expect(prisma.item.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isVeg: true,
        isEggless: true,
        isBestseller: true,
        isAvailable: true,
      }),
    });
  });

  it("falls back to a sensible unit when none is given", async () => {
    await redirectTo(() => actions.createItem(form({ ...base, unit: "" })));

    expect(prisma.item.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ unit: "per piece" }),
    });
  });

  it("puts the new item after the last one in its category", async () => {
    prisma.item.findFirst.mockResolvedValue({ sortOrder: 4 });

    await redirectTo(() => actions.createItem(form(base)));

    expect(prisma.item.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sortOrder: 5 }),
    });
  });

  describe("the price as it was typed", () => {
    it.each([
      ["₹650", 650],
      ["1,250", 1250],
      ["649.50", 649.5],
      ["  75 ", 75],
      ["649.567", 649.57],
      // The sign is stripped with everything else that is not a digit, which
      // is what makes a negative price impossible to enter at all.
      ["-40", 40],
    ])("reads %s as %s", async (typed, expected) => {
      await redirectTo(() => actions.createItem(form({ ...base, price: typed })));

      expect(prisma.item.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ price: expected }),
      });
    });

    // A form posted without the field at all, rather than with it empty.
    it("reads a missing price field as nothing", async () => {
      const fields = { ...base } as Record<string, string>;
      delete fields.price;

      await redirectTo(() => actions.createItem(form(fields)));

      expect(prisma.item.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ price: 0 }),
      });
    });

    // Nonsense in the box should not become a NaN price in the database.
    it.each([["not a price"], [""], ["₹"]])("reads %s as nothing", async (typed) => {
      await redirectTo(() => actions.createItem(form({ ...base, price: typed })));

      expect(prisma.item.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ price: 0 }),
      });
    });
  });

  describe("sizes", () => {
    it("keeps each labelled size with its price, in the order given", async () => {
      await redirectTo(() =>
        actions.createItem(
          form({
            ...base,
            variantLabel: ["500 g", "1 kg"],
            variantPrice: ["350", "650"],
          }),
        ),
      );

      expect(prisma.item.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          variants: {
            create: [
              { label: "500 g", price: 350, sortOrder: 0 },
              { label: "1 kg", price: 650, sortOrder: 1 },
            ],
          },
        }),
      });
    });

    // The form always sends one blank row for adding another size.
    it("drops rows the owner left empty", async () => {
      await redirectTo(() =>
        actions.createItem(
          form({ ...base, variantLabel: ["500 g", "  ", ""], variantPrice: ["350", "", "99"] }),
        ),
      );

      expect(prisma.item.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          variants: { create: [{ label: "500 g", price: 350, sortOrder: 0 }] },
        }),
      });
    });

    it("drops a size whose price is missing or nonsense", async () => {
      await redirectTo(() =>
        actions.createItem(
          form({
            ...base,
            variantLabel: ["500 g", "1 kg", "2 kg"],
            variantPrice: ["", "abc", "-5"],
          }),
        ),
      );

      expect(prisma.item.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ variants: { create: [] } }),
      });
    });

    it("rounds a size price to paise", async () => {
      await redirectTo(() =>
        actions.createItem(form({ ...base, variantLabel: "500 g", variantPrice: "350.456" })),
      );

      expect(prisma.item.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          variants: { create: [{ label: "500 g", price: 350.46, sortOrder: 0 }] },
        }),
      });
    });
  });

  describe("the photo", () => {
    it("stores an uploaded file and keeps its address", async () => {
      images.saveImage.mockResolvedValue({ url: "https://res.cloudinary.com/c/new.jpg" });

      await redirectTo(() => actions.createItem(withFile(base)));

      expect(prisma.item.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ imageUrl: "https://res.cloudinary.com/c/new.jpg" }),
      });
    });

    it("fetches a pasted link when no file was chosen", async () => {
      images.saveImageFromUrl.mockResolvedValue({ url: "https://res.cloudinary.com/c/link.jpg" });

      await redirectTo(() =>
        actions.createItem(form({ ...base, imageLink: "https://example.com/cake.jpg" })),
      );

      expect(images.saveImageFromUrl).toHaveBeenCalledWith("https://example.com/cake.jpg");
      expect(prisma.item.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ imageUrl: "https://res.cloudinary.com/c/link.jpg" }),
      });
    });

    // Going and finding a file is the more deliberate act of the two.
    it("prefers a chosen file over a link left in the box", async () => {
      images.saveImage.mockResolvedValue({ url: "https://res.cloudinary.com/c/file.jpg" });

      await redirectTo(() =>
        actions.createItem(withFile({ ...base, imageLink: "https://example.com/cake.jpg" })),
      );

      expect(images.saveImageFromUrl).not.toHaveBeenCalled();
      expect(prisma.item.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ imageUrl: "https://res.cloudinary.com/c/file.jpg" }),
      });
    });

    it("ignores an empty file input", async () => {
      await redirectTo(() => actions.createItem(withFile(base, 0)));

      expect(images.saveImage).not.toHaveBeenCalled();
      expect(prisma.item.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ imageUrl: null }),
      });
    });

    // Saving the item without its photo would look like a success.
    it("sends the owner back with the reason rather than saving without it", async () => {
      images.saveImage.mockResolvedValue({ error: "That file is not a picture." });

      const to = await redirectTo(() => actions.createItem(withFile(base)));

      expect(to).toBe("/admin/categories/c1/new?error=That%20file%20is%20not%20a%20picture.");
      expect(prisma.item.create).not.toHaveBeenCalled();
    });
  });
});

describe("updateItem", () => {
  const base = { id: "i1", categoryId: "c1", name: "Choco Truffle", price: "650" };
  const existing = { id: "i1", categoryId: "c1", imageUrl: "https://res.cloudinary.com/c/old.jpg" };

  beforeEach(() => {
    prisma.item.findUnique.mockResolvedValue(existing);
  });

  it("replaces the sizes wholesale rather than merging them", async () => {
    await redirectTo(() =>
      actions.updateItem(form({ ...base, variantLabel: "1 kg", variantPrice: "650" })),
    );

    expect(prisma.itemVariant.deleteMany).toHaveBeenCalledWith({ where: { itemId: "i1" } });
    expect(prisma.item.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          variants: { create: [{ label: "1 kg", price: 650, sortOrder: 0 }] },
        }),
      }),
    );
  });

  it.each([
    ["no id", { ...base, id: "" }],
    ["no category", { ...base, categoryId: "" }],
    ["no name", { ...base, name: "" }],
  ])("does nothing with %s", async (_case, fields) => {
    await actions.updateItem(form(fields));
    expect(prisma.item.update).not.toHaveBeenCalled();
  });

  it("does nothing when the item is no longer there", async () => {
    prisma.item.findUnique.mockResolvedValue(null);

    await actions.updateItem(form(base));

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("keeps the existing photo when nothing new was supplied", async () => {
    await redirectTo(() => actions.updateItem(form(base)));

    expect(images.deleteImage).not.toHaveBeenCalled();
    expect(prisma.item.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ imageUrl: existing.imageUrl }),
      }),
    );
  });

  // Otherwise the store fills up with files nothing points at.
  it("clears the old photo when a new one replaces it", async () => {
    images.saveImage.mockResolvedValue({ url: "https://res.cloudinary.com/c/new.jpg" });

    await redirectTo(() => actions.updateItem(withFile(base)));

    expect(images.deleteImage).toHaveBeenCalledWith(existing.imageUrl);
    expect(prisma.item.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ imageUrl: "https://res.cloudinary.com/c/new.jpg" }),
      }),
    );
  });

  it("clears the old photo when the owner removes it outright", async () => {
    await redirectTo(() => actions.updateItem(form({ ...base, removeImage: "on" })));

    expect(images.deleteImage).toHaveBeenCalledWith(existing.imageUrl);
    expect(prisma.item.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ imageUrl: null }) }),
    );
  });

  it("has nothing to clear when the item had no photo to begin with", async () => {
    prisma.item.findUnique.mockResolvedValue({ ...existing, imageUrl: null });

    await redirectTo(() => actions.updateItem(form({ ...base, removeImage: "on" })));

    expect(images.deleteImage).not.toHaveBeenCalled();
  });

  it("takes a pasted link here too", async () => {
    images.saveImageFromUrl.mockResolvedValue({ url: "https://res.cloudinary.com/c/link.jpg" });

    await redirectTo(() =>
      actions.updateItem(form({ ...base, imageLink: "https://example.com/cake.jpg" })),
    );

    expect(images.saveImageFromUrl).toHaveBeenCalledWith("https://example.com/cake.jpg");
  });

  it("sends the owner back to the item when the photo cannot be saved", async () => {
    images.saveImageFromUrl.mockResolvedValue({ error: "That address is not reachable." });

    const to = await redirectTo(() =>
      actions.updateItem(form({ ...base, imageLink: "https://example.com/x.jpg" })),
    );

    expect(to).toBe("/admin/items/i1?error=That%20address%20is%20not%20reachable.");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // Both menus change when an item moves house, not just the new one.
  it("refreshes the old category as well when the item is moved", async () => {
    await redirectTo(() => actions.updateItem(form({ ...base, categoryId: "c2" })));

    expect(revalidatePath).toHaveBeenCalledWith("/admin/categories/c2");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/categories/c1");
  });

  it("refreshes only the one category when the item stays put", async () => {
    await redirectTo(() => actions.updateItem(form(base)));

    const refreshed = revalidatePath.mock.calls.map(([path]) => path);
    expect(refreshed.filter((path) => path === "/admin/categories/c1")).toHaveLength(1);
  });
});

describe("toggleItemAvailable", () => {
  it("marks an available item sold out", async () => {
    prisma.item.findUnique.mockResolvedValue({ id: "i1", categoryId: "c1", isAvailable: true });

    await actions.toggleItemAvailable(form({ id: "i1" }));

    expect(prisma.item.update).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: { isAvailable: false },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/categories/c1");
  });

  it("puts a sold-out item back on sale", async () => {
    prisma.item.findUnique.mockResolvedValue({ id: "i1", categoryId: "c1", isAvailable: false });

    await actions.toggleItemAvailable(form({ id: "i1" }));

    expect(prisma.item.update).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: { isAvailable: true },
    });
  });

  it("does nothing for an item that is not there", async () => {
    await actions.toggleItemAvailable(form({ id: "gone" }));
    expect(prisma.item.update).not.toHaveBeenCalled();
  });
});

describe("moveItem", () => {
  const siblings = [
    { id: "a", categoryId: "c1" },
    { id: "b", categoryId: "c1" },
    { id: "c", categoryId: "c1" },
  ];

  beforeEach(() => {
    prisma.item.findMany.mockResolvedValue(siblings);
  });

  it("swaps with the one above", async () => {
    prisma.item.findUnique.mockResolvedValue(siblings[1]);

    await actions.moveItem(form({ id: "b", direction: "up" }));

    expect(prisma.item.update).toHaveBeenCalledWith({
      where: { id: "b" },
      data: { sortOrder: 0 },
    });
    expect(prisma.item.update).toHaveBeenCalledWith({
      where: { id: "a" },
      data: { sortOrder: 1 },
    });
  });

  it("swaps with the one below", async () => {
    prisma.item.findUnique.mockResolvedValue(siblings[1]);

    await actions.moveItem(form({ id: "b", direction: "down" }));

    expect(prisma.item.update).toHaveBeenCalledWith({
      where: { id: "b" },
      data: { sortOrder: 2 },
    });
  });

  it.each([
    ["the first item up", "a", "up"],
    ["the last item down", "c", "down"],
  ])("refuses to move %s", async (_case, id, direction) => {
    prisma.item.findUnique.mockResolvedValue(siblings.find((one) => one.id === id));

    await actions.moveItem(form({ id, direction }));

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("does nothing for an item that is not there", async () => {
    await actions.moveItem(form({ id: "gone", direction: "up" }));
    expect(prisma.item.findMany).not.toHaveBeenCalled();
  });

  // The item exists but its category lists different children — a stale read.
  it("does nothing when the item is missing from its own category", async () => {
    prisma.item.findUnique.mockResolvedValue({ id: "z", categoryId: "c1" });

    await actions.moveItem(form({ id: "z", direction: "up" }));

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("deleteItem", () => {
  it("clears the photo, deletes the item and goes back to the category", async () => {
    prisma.item.findUnique.mockResolvedValue({
      id: "i1",
      categoryId: "c1",
      imageUrl: "https://res.cloudinary.com/c/a.jpg",
    });

    const to = await redirectTo(() => actions.deleteItem(form({ id: "i1" })));

    expect(images.deleteImage).toHaveBeenCalledWith("https://res.cloudinary.com/c/a.jpg");
    expect(prisma.item.delete).toHaveBeenCalledWith({ where: { id: "i1" } });
    expect(to).toBe("/admin/categories/c1");
  });

  it("does nothing for an item that is not there", async () => {
    await actions.deleteItem(form({ id: "gone" }));
    expect(prisma.item.delete).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------ appearance

describe("saveAppearance", () => {
  it("stores the chosen background", async () => {
    const to = await redirectTo(() => actions.saveAppearance(form({ backgroundId: "dots" })));

    expect(prisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { value: "dots" } }),
    );
    expect(to).toBe("/admin/appearance?saved=1");
  });

  it("ignores a background that is not one of the offered ones", async () => {
    await actions.saveAppearance(form({ backgroundId: "rainbow" }));
    expect(prisma.setting.upsert).not.toHaveBeenCalled();
  });

  it("keeps the photo already uploaded when only the pattern changes", async () => {
    prisma.setting.findUnique.mockResolvedValue({ value: "https://res.cloudinary.com/c/bg.jpg" });

    await redirectTo(() => actions.saveAppearance(form({ backgroundId: "custom" })));

    expect(images.deleteImage).not.toHaveBeenCalled();
    expect(prisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { value: "https://res.cloudinary.com/c/bg.jpg" } }),
    );
  });

  it("clears the old photo when a new one is uploaded over it", async () => {
    prisma.setting.findUnique.mockResolvedValue({ value: "https://res.cloudinary.com/c/old.jpg" });
    images.saveImage.mockResolvedValue({ url: "https://res.cloudinary.com/c/new.jpg" });

    const data = form({ backgroundId: "custom" });
    data.append("backgroundImage", new Blob([new Uint8Array(3)], { type: "image/jpeg" }), "bg.jpg");

    await redirectTo(() => actions.saveAppearance(data));

    expect(images.deleteImage).toHaveBeenCalledWith("https://res.cloudinary.com/c/old.jpg");
  });

  // Choosing the photo background with no photo would render a blank page.
  it("refuses the photo background when there is no photo", async () => {
    const to = await redirectTo(() => actions.saveAppearance(form({ backgroundId: "custom" })));

    expect(to).toContain("error=");
    expect(decodeURIComponent(to)).toContain("Choose a photo to upload first.");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("reports a photo that could not be stored", async () => {
    images.saveImage.mockResolvedValue({ error: "That file is too large." });

    const to = await redirectTo(() => actions.saveAppearance(form({ backgroundId: "dots" })));

    expect(decodeURIComponent(to)).toContain("That file is too large.");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("removeBackgroundImage", () => {
  it("deletes the photo and drops back to the plain background", async () => {
    prisma.setting.findUnique
      .mockResolvedValueOnce({ value: "https://res.cloudinary.com/c/bg.jpg" })
      .mockResolvedValueOnce({ value: "custom" });

    const to = await redirectTo(() => actions.removeBackgroundImage());

    expect(images.deleteImage).toHaveBeenCalledWith("https://res.cloudinary.com/c/bg.jpg");
    expect(prisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { value: "plain" } }),
    );
    expect(to).toBe("/admin/appearance?saved=1");
  });

  // Removing an unused photo should not also undo a pattern the owner picked.
  it("leaves the chosen pattern alone when the photo was not the one showing", async () => {
    prisma.setting.findUnique
      .mockResolvedValueOnce({ value: "https://res.cloudinary.com/c/bg.jpg" })
      .mockResolvedValueOnce({ value: "linen" });

    await redirectTo(() => actions.removeBackgroundImage());

    expect(prisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { value: "linen" } }),
    );
  });

  it("falls back to plain when no background was ever chosen", async () => {
    await redirectTo(() => actions.removeBackgroundImage());

    expect(images.deleteImage).toHaveBeenCalledWith(null);
    expect(prisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { value: "plain" } }),
    );
  });
});

// ----------------------------------------------------------------------- hours

describe("saveHours", () => {
  it("saves the opening and closing times", async () => {
    const to = await redirectTo(() =>
      actions.saveHours(form({ open: "07:00", close: "21:00" })),
    );

    expect(prisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { key: "hours.open", value: "07:00" } }),
    );
    expect(prisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { key: "hours.close", value: "21:00" } }),
    );
    expect(to).toBe("/admin/hours?saved=1");
  });

  it("records the weekly off days as a list", async () => {
    await redirectTo(() =>
      actions.saveHours(form({ open: "07:00", close: "21:00", closedDays: ["0", "3"] })),
    );

    expect(prisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { key: "hours.closedDays", value: "0,3" } }),
    );
  });

  it("ignores day numbers that are not days of the week", async () => {
    await redirectTo(() =>
      actions.saveHours(form({ open: "07:00", close: "21:00", closedDays: ["0", "9", "abc", "-1"] })),
    );

    expect(prisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { key: "hours.closedDays", value: "0" } }),
    );
  });

  it("removes the hours entirely when the owner clears them", async () => {
    const to = await redirectTo(() => actions.saveHours(form({ clear: "1" })));

    expect(prisma.setting.deleteMany).toHaveBeenCalledWith({
      where: { key: { in: ["hours.open", "hours.close", "hours.closedDays"] } },
    });
    expect(to).toBe("/admin/hours?saved=1");
  });

  it.each([
    ["neither time", { open: "", close: "" }],
    ["only an opening time", { open: "07:00", close: "" }],
    ["a time that is not a time", { open: "morning", close: "21:00" }],
    ["an hour that does not exist", { open: "25:00", close: "21:00" }],
  ])("refuses %s", async (_case, fields) => {
    const to = await redirectTo(() => actions.saveHours(form(fields)));

    expect(decodeURIComponent(to)).toContain("both an opening and a closing time");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // Closing every day would shut the menu permanently — always a mis-click.
  it("refuses to close the shop seven days a week", async () => {
    const to = await redirectTo(() =>
      actions.saveHours(
        form({ open: "07:00", close: "21:00", closedDays: ["0", "1", "2", "3", "4", "5", "6"] }),
      ),
    );

    expect(decodeURIComponent(to)).toContain("cannot be closed every day");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------- offers

describe("saveOffer", () => {
  it("saves the text, note, colour and whether it is showing", async () => {
    const to = await redirectTo(() =>
      actions.saveOffer(
        form({
          text: "Ganesh Chaturthi — 15% off",
          note: "Till Sunday",
          tone: "gold",
          isVisible: "on",
        }),
      ),
    );

    expect(prisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { key: "offer.text", value: "Ganesh Chaturthi — 15% off" } }),
    );
    expect(prisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { key: "offer.tone", value: "gold" } }),
    );
    expect(prisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { key: "offer.isVisible", value: "true" } }),
    );
    expect(to).toBe("/admin/offers?saved=1");
  });

  it("records an unticked strip as hidden", async () => {
    await redirectTo(() => actions.saveOffer(form({ text: "Diwali offer", tone: "gold" })));

    expect(prisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { key: "offer.isVisible", value: "false" } }),
    );
  });

  it("falls back to the festive colour when the tone is not one we offer", async () => {
    await redirectTo(() => actions.saveOffer(form({ text: "Diwali offer", tone: "rainbow" })));

    expect(prisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { key: "offer.tone", value: "festive" } }),
    );
  });

  // The strip is a fixed height on the menu; overlong text would spill out.
  it("trims text and note to what the strip can show", async () => {
    await redirectTo(() =>
      actions.saveOffer(form({ text: "a".repeat(200), note: "b".repeat(200), tone: "gold" })),
    );

    const saved = Object.fromEntries(
      prisma.setting.upsert.mock.calls.map(([call]) => [call.create.key, call.create.value]),
    );
    expect(saved["offer.text"]).toHaveLength(90);
    expect(saved["offer.note"]).toHaveLength(120);
  });

  it("refuses an offer with no text", async () => {
    const to = await redirectTo(() => actions.saveOffer(form({ text: "   ", tone: "gold" })));

    expect(decodeURIComponent(to)).toContain("Write the offer text first.");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("removeOffer", () => {
  it("clears the strip entirely, text and all", async () => {
    const to = await redirectTo(() => actions.removeOffer());

    expect(prisma.setting.deleteMany).toHaveBeenCalledWith({
      where: {
        key: { in: ["offer.text", "offer.note", "offer.tone", "offer.isVisible"] },
      },
    });
    expect(to).toBe("/admin/offers?saved=1");
  });
});

// -------------------------------------------------------------------- ordering

describe("saveOrdering", () => {
  const originalWhatsapp = process.env.SHOP_WHATSAPP;
  const originalPhone = process.env.SHOP_PHONE;

  beforeEach(() => {
    process.env.SHOP_WHATSAPP = "+91 76660 93143";
    delete process.env.SHOP_PHONE;
  });

  afterEach(() => {
    if (originalWhatsapp === undefined) delete process.env.SHOP_WHATSAPP;
    else process.env.SHOP_WHATSAPP = originalWhatsapp;
    if (originalPhone === undefined) delete process.env.SHOP_PHONE;
    else process.env.SHOP_PHONE = originalPhone;
  });

  function saved(key: string): string | undefined {
    const call = prisma.setting.upsert.mock.calls.find(([args]) => args.where.key === key);
    return call?.[0].create.value;
  }

  it("switches ordering on with table and counter orders", async () => {
    const to = await redirectTo(() =>
      actions.saveOrdering(
        form({ enabled: "on", table: "on", counter: "on", tables: "8", onlyWhenOpen: "on" }),
      ),
    );

    expect(saved("ordering.enabled")).toBe("1");
    expect(saved("ordering.table")).toBe("1");
    expect(saved("ordering.counter")).toBe("1");
    expect(saved("ordering.pickup")).toBe("0");
    expect(saved("ordering.delivery")).toBe("0");
    expect(saved("ordering.tables")).toBe("8");
    expect(saved("ordering.whatsapp")).toBe("");
    expect(saved("ordering.minOrder")).toBe("0");
    expect(saved("ordering.onlyWhenOpen")).toBe("1");
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(to).toBe("/admin/ordering?saved=1");
  });

  it("saves a number of its own and a minimum order", async () => {
    await redirectTo(() =>
      actions.saveOrdering(
        form({ enabled: "on", counter: "on", whatsapp: "98765 43210", minOrder: "199.6" }),
      ),
    );
    expect(saved("ordering.whatsapp")).toBe("98765 43210");
    expect(saved("ordering.minOrder")).toBe("200");
  });

  it("switches ordering off without asking for anything else", async () => {
    delete process.env.SHOP_WHATSAPP;
    const to = await redirectTo(() => actions.saveOrdering(form({})));

    expect(saved("ordering.enabled")).toBe("0");
    expect(to).toBe("/admin/ordering?saved=1");
  });

  it("keeps the saved table count when table orders are off and the box is empty", async () => {
    await redirectTo(() => actions.saveOrdering(form({ enabled: "on", counter: "on", tables: "" })));
    expect(saved("ordering.tables")).toBeUndefined();
  });

  it.each(["", "0", "201", "2.5"])("refuses a table count of %j while table orders are on", async (tables) => {
    const to = await redirectTo(() => actions.saveOrdering(form({ enabled: "on", table: "on", tables })));
    expect(decodeURIComponent(to)).toMatch(/how many tables/);
    expect(prisma.setting.upsert).not.toHaveBeenCalled();
  });

  it("refuses a WhatsApp number that is too short", async () => {
    const to = await redirectTo(() =>
      actions.saveOrdering(form({ enabled: "on", counter: "on", whatsapp: "12345" })),
    );
    expect(decodeURIComponent(to)).toMatch(/looks too short/);
  });

  it("refuses ordering on with no way to order", async () => {
    const to = await redirectTo(() => actions.saveOrdering(form({ enabled: "on" })));
    expect(decodeURIComponent(to)).toMatch(/at least one way to order/);
  });

  it("refuses ordering on with no number to send orders to", async () => {
    delete process.env.SHOP_WHATSAPP;
    const to = await redirectTo(() => actions.saveOrdering(form({ enabled: "on", counter: "on" })));
    expect(decodeURIComponent(to)).toMatch(/Add the WhatsApp number/);
  });

  it("accepts the shop's phone number when there is no WhatsApp number", async () => {
    delete process.env.SHOP_WHATSAPP;
    process.env.SHOP_PHONE = "+91 76660 93143";
    const to = await redirectTo(() => actions.saveOrdering(form({ enabled: "on", counter: "on" })));
    expect(to).toBe("/admin/ordering?saved=1");
  });
});

describe("saveOrdering — payment", () => {
  const originalWhatsapp = process.env.SHOP_WHATSAPP;
  beforeEach(() => {
    process.env.SHOP_WHATSAPP = "+91 76660 93143";
  });
  afterEach(() => {
    if (originalWhatsapp === undefined) delete process.env.SHOP_WHATSAPP;
    else process.env.SHOP_WHATSAPP = originalWhatsapp;
  });

  function saved(key: string): string | undefined {
    const call = prisma.setting.upsert.mock.calls.find(([args]) => args.where.key === key);
    return call?.[0].create.value;
  }

  const base = { enabled: "on", counter: "on" };

  it("saves the ways to pay and the UPI ID", async () => {
    await redirectTo(() =>
      actions.saveOrdering(form({ ...base, pay_cash: "on", pay_upi: "on", upiId: "shivam@okaxis" })),
    );
    expect(saved("ordering.payments")).toBe("cash,upi");
    expect(saved("ordering.upiId")).toBe("shivam@okaxis");
    expect(saved("ordering.upiQr")).toBe("");
  });

  it("refuses a UPI ID that isn't one", async () => {
    const to = await redirectTo(() => actions.saveOrdering(form({ ...base, upiId: "shivam" })));
    expect(decodeURIComponent(to)).toMatch(/UPI ID doesn't look right/);
    expect(prisma.setting.upsert).not.toHaveBeenCalled();
  });

  it("won't offer UPI with nothing for customers to pay to", async () => {
    const to = await redirectTo(() => actions.saveOrdering(form({ ...base, pay_upi: "on" })));
    expect(decodeURIComponent(to)).toMatch(/Add your UPI ID or upload your UPI QR/);
  });

  it("saves an uploaded QR, and clears away the one it replaces", async () => {
    prisma.setting.findUnique.mockResolvedValue({ key: "ordering.upiQr", value: "/uploads/old.png" });
    images.saveImage.mockResolvedValue({ url: "/uploads/new.png" });

    await redirectTo(() => actions.saveOrdering(withFile({ ...base, pay_upi: "on" })));

    expect(saved("ordering.upiQr")).toBe("/uploads/new.png");
    expect(images.deleteImage).toHaveBeenCalledWith("/uploads/old.png");
  });

  it("keeps the saved QR when no new one is chosen", async () => {
    prisma.setting.findUnique.mockResolvedValue({ key: "ordering.upiQr", value: "/uploads/qr.png" });
    await redirectTo(() => actions.saveOrdering(form({ ...base, pay_upi: "on" })));

    expect(saved("ordering.upiQr")).toBe("/uploads/qr.png");
    expect(images.deleteImage).not.toHaveBeenCalled();
  });

  it("removes the QR when asked", async () => {
    prisma.setting.findUnique.mockResolvedValue({ key: "ordering.upiQr", value: "/uploads/qr.png" });
    await redirectTo(() => actions.saveOrdering(form({ ...base, removeUpiQr: "on" })));

    expect(saved("ordering.upiQr")).toBe("");
    expect(images.deleteImage).toHaveBeenCalledWith("/uploads/qr.png");
  });

  it("says what was wrong with a QR upload", async () => {
    images.saveImage.mockResolvedValue({ error: "Image is larger than 5 MB." });
    const to = await redirectTo(() => actions.saveOrdering(withFile(base)));
    expect(decodeURIComponent(to)).toMatch(/larger than 5 MB/);
  });
});

describe("setOrderStatus", () => {
  it("moves an order to the chosen status", async () => {
    await actions.setOrderStatus(form({ id: "o1", status: "ready" }));
    expect(prisma.order.update).toHaveBeenCalledWith({ where: { id: "o1" }, data: { status: "ready" } });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/orders");
  });

  it.each([
    ["an unknown status", { id: "o1", status: "lost" }],
    ["no order", { status: "ready" }],
  ])("ignores %s", async (_, fields) => {
    await actions.setOrderStatus(form(fields));
    expect(prisma.order.update).not.toHaveBeenCalled();
  });
});

describe("setOrderPaid", () => {
  it("marks an order paid, and back again", async () => {
    await actions.setOrderPaid(form({ id: "o1", paid: "1" }));
    await actions.setOrderPaid(form({ id: "o1", paid: "0" }));
    expect(prisma.order.update.mock.calls).toEqual([
      [{ where: { id: "o1" }, data: { paid: true } }],
      [{ where: { id: "o1" }, data: { paid: false } }],
    ]);
  });

  it("ignores a request with no order", async () => {
    await actions.setOrderPaid(form({ paid: "1" }));
    expect(prisma.order.update).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------- security

describe("every action needs the signed-in owner", () => {
  // Server actions are endpoints of their own, callable from any route, so the
  // /admin middleware alone does not protect them. Each must check itself.
  const everyAction = Object.entries(actions).filter(([, value]) => typeof value === "function");

  it("covers every action the dashboard exports", () => {
    expect(everyAction.map(([name]) => name).sort()).toEqual(
      [
        "createCategory",
        "createItem",
        "deleteCategory",
        "deleteItem",
        "moveCategory",
        "moveItem",
        "removeBackgroundImage",
        "removeOffer",
        "saveAppearance",
        "saveHours",
        "saveOffer",
        "saveOrdering",
        "setOrderPaid",
        "setOrderStatus",
        "toggleCategoryVisible",
        "toggleItemAvailable",
        "updateCategory",
        "updateItem",
      ].sort(),
    );
  });

  it.each(everyAction)("%s refuses a visitor who is not signed in, touching nothing", async (_, action) => {
    auth.requireAdmin.mockImplementation(async () => {
      throw new Redirected("/admin/login");
    });
    const busy = form({ id: "x", name: "Hacked", status: "cancelled", paid: "1", enabled: "on" });

    const to = await redirectTo(() => (action as (data: FormData) => Promise<unknown>)(busy));

    expect(to).toBe("/admin/login");
    for (const table of [prisma.category, prisma.item, prisma.setting, prisma.order]) {
      for (const method of Object.values(table)) expect(method).not.toHaveBeenCalled();
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(images.deleteImage).not.toHaveBeenCalled();
  });
});
