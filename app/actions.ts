"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/types";
import { deleteImage, saveImage } from "@/lib/saveImage";

// Every mutation the owner can perform. Middleware has already rejected
// anyone without a session before these run.

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function checked(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

function money(formData: FormData, key: string): number {
  const value = Number.parseFloat(String(formData.get(key) ?? "0").replace(/[^0-9.]/g, ""));
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : 0;
}

/** Keeps slugs unique — "cakes", then "cakes-2", "cakes-3". */
async function uniqueSlug(name: string, exceptId?: string): Promise<string> {
  const base = slugify(name) || "category";
  let candidate = base;
  let suffix = 2;

  for (;;) {
    const clash = await prisma.category.findUnique({ where: { slug: candidate } });
    if (!clash || clash.id === exceptId) return candidate;
    candidate = `${base}-${suffix++}`;
  }
}

// ---------------------------------------------------------------- categories

export async function createCategory(formData: FormData) {
  const name = text(formData, "name");
  if (!name) return;

  const last = await prisma.category.findFirst({ orderBy: { sortOrder: "desc" } });

  await prisma.category.create({
    data: {
      name,
      slug: await uniqueSlug(name),
      description: text(formData, "description"),
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath("/");
}

export async function updateCategory(formData: FormData) {
  const id = text(formData, "id");
  const name = text(formData, "name");
  if (!id || !name) return;

  await prisma.category.update({
    where: { id },
    data: {
      name,
      slug: await uniqueSlug(name, id),
      description: text(formData, "description"),
    },
  });

  revalidatePath("/");
  revalidatePath(`/categories/${id}`);
}

export async function toggleCategoryVisible(formData: FormData) {
  const id = text(formData, "id");
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) return;

  await prisma.category.update({
    where: { id },
    data: { isVisible: !category.isVisible },
  });

  revalidatePath("/");
}

/** Swaps sortOrder with the neighbour above or below. */
export async function moveCategory(formData: FormData) {
  const id = text(formData, "id");
  const direction = text(formData, "direction");

  const all = await prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const index = all.findIndex((category) => category.id === id);
  if (index === -1) return;

  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= all.length) return;

  await prisma.$transaction([
    prisma.category.update({ where: { id: all[index].id }, data: { sortOrder: swapWith } }),
    prisma.category.update({ where: { id: all[swapWith].id }, data: { sortOrder: index } }),
  ]);

  revalidatePath("/");
}

export async function deleteCategory(formData: FormData) {
  const id = text(formData, "id");
  const moveTo = text(formData, "moveTo");

  if (moveTo) {
    // Keep the items, hand them to another category.
    await prisma.item.updateMany({ where: { categoryId: id }, data: { categoryId: moveTo } });
  } else {
    // Delete the items too — clear their photos off disk first.
    const items = await prisma.item.findMany({ where: { categoryId: id } });
    await Promise.all(items.map((item) => deleteImage(item.imageUrl)));
  }

  await prisma.category.delete({ where: { id } });
  revalidatePath("/");
  redirect("/");
}

// --------------------------------------------------------------------- items

/** Variants arrive as parallel arrays from repeated form fields. */
function readVariants(formData: FormData) {
  const labels = formData.getAll("variantLabel").map((value) => String(value).trim());
  const prices = formData.getAll("variantPrice").map((value) => Number.parseFloat(String(value)));

  return labels
    .map((label, index) => ({ label, price: prices[index], sortOrder: index }))
    .filter((variant) => variant.label.length > 0 && Number.isFinite(variant.price) && variant.price >= 0)
    .map((variant) => ({ ...variant, price: Math.round(variant.price * 100) / 100 }));
}

export async function createItem(formData: FormData) {
  const categoryId = text(formData, "categoryId");
  const name = text(formData, "name");
  if (!categoryId || !name) return;

  const saved = await saveImage(formData.get("image") as File | null);
  if (saved && "error" in saved) {
    redirect(`/categories/${categoryId}?error=${encodeURIComponent(saved.error)}`);
  }

  const last = await prisma.item.findFirst({
    where: { categoryId },
    orderBy: { sortOrder: "desc" },
  });

  await prisma.item.create({
    data: {
      categoryId,
      name,
      description: text(formData, "description"),
      price: money(formData, "price"),
      unit: text(formData, "unit") || "per piece",
      imageUrl: saved && "url" in saved ? saved.url : null,
      isVeg: checked(formData, "isVeg"),
      isEggless: checked(formData, "isEggless"),
      isBestseller: checked(formData, "isBestseller"),
      isAvailable: checked(formData, "isAvailable"),
      sortOrder: (last?.sortOrder ?? 0) + 1,
      variants: { create: readVariants(formData) },
    },
  });

  revalidatePath("/");
  revalidatePath(`/categories/${categoryId}`);
  redirect(`/categories/${categoryId}`);
}

export async function updateItem(formData: FormData) {
  const id = text(formData, "id");
  const categoryId = text(formData, "categoryId");
  const name = text(formData, "name");
  if (!id || !categoryId || !name) return;

  const existing = await prisma.item.findUnique({ where: { id } });
  if (!existing) return;

  const saved = await saveImage(formData.get("image") as File | null);
  if (saved && "error" in saved) {
    redirect(`/items/${id}?error=${encodeURIComponent(saved.error)}`);
  }

  const removeImage = checked(formData, "removeImage");
  const newUrl = saved && "url" in saved ? saved.url : null;

  // Replacing or clearing a photo leaves the old file orphaned on disk.
  if ((newUrl || removeImage) && existing.imageUrl) {
    await deleteImage(existing.imageUrl);
  }

  await prisma.$transaction([
    prisma.itemVariant.deleteMany({ where: { itemId: id } }),
    prisma.item.update({
      where: { id },
      data: {
        categoryId,
        name,
        description: text(formData, "description"),
        price: money(formData, "price"),
        unit: text(formData, "unit") || "per piece",
        imageUrl: newUrl ?? (removeImage ? null : existing.imageUrl),
        isVeg: checked(formData, "isVeg"),
        isEggless: checked(formData, "isEggless"),
        isBestseller: checked(formData, "isBestseller"),
        isAvailable: checked(formData, "isAvailable"),
        variants: { create: readVariants(formData) },
      },
    }),
  ]);

  revalidatePath("/");
  revalidatePath(`/categories/${categoryId}`);
  if (existing.categoryId !== categoryId) revalidatePath(`/categories/${existing.categoryId}`);
  redirect(`/categories/${categoryId}`);
}

export async function toggleItemAvailable(formData: FormData) {
  const id = text(formData, "id");
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return;

  await prisma.item.update({ where: { id }, data: { isAvailable: !item.isAvailable } });

  revalidatePath("/");
  revalidatePath(`/categories/${item.categoryId}`);
}

export async function moveItem(formData: FormData) {
  const id = text(formData, "id");
  const direction = text(formData, "direction");

  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return;

  const siblings = await prisma.item.findMany({
    where: { categoryId: item.categoryId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const index = siblings.findIndex((sibling) => sibling.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= siblings.length) return;

  await prisma.$transaction([
    prisma.item.update({ where: { id: siblings[index].id }, data: { sortOrder: swapWith } }),
    prisma.item.update({ where: { id: siblings[swapWith].id }, data: { sortOrder: index } }),
  ]);

  revalidatePath("/");
  revalidatePath(`/categories/${item.categoryId}`);
}

export async function deleteItem(formData: FormData) {
  const id = text(formData, "id");

  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return;

  await deleteImage(item.imageUrl);
  await prisma.item.delete({ where: { id } });

  revalidatePath("/");
  revalidatePath(`/categories/${item.categoryId}`);
  redirect(`/categories/${item.categoryId}`);
}
