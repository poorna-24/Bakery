"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/types";
import { deleteImage, saveImage, saveImageFromUrl } from "@/lib/saveImage";
import { SETTING_KEYS, isBackgroundId } from "@/lib/backgrounds";
import { HOURS_KEYS, isValidTime } from "@/lib/hours";
import { MAX_OFFER_NOTE, MAX_OFFER_TEXT, OFFER_KEYS, isOfferTone } from "@/lib/offer";
import {
  MAX_TABLES,
  ORDERING_KEYS,
  ORDER_MODES,
  PAYMENT_METHODS,
  isUpiId,
  isWhatsappNumber,
} from "@/lib/ordering";
import { isOrderStatus } from "@/lib/orders";

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
  revalidatePath(`/admin/categories/${id}`);
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
/**
 * Resolves the photo for an item, whichever way the owner supplied it.
 *
 * A chosen file wins over a pasted link: if both are filled in, the file is
 * the more deliberate action — you have to go and find it.
 */
async function resolveImage(formData: FormData) {
  const file = formData.get("image") as File | null;
  if (file && file.size > 0) return saveImage(file);

  const link = text(formData, "imageLink");
  if (link) return saveImageFromUrl(link);

  return null;
}

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

  const saved = await resolveImage(formData);
  if (saved && "error" in saved) {
    redirect(`/admin/categories/${categoryId}/new?error=${encodeURIComponent(saved.error)}`);
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
  revalidatePath(`/admin/categories/${categoryId}`);
  redirect(`/admin/categories/${categoryId}`);
}

export async function updateItem(formData: FormData) {
  const id = text(formData, "id");
  const categoryId = text(formData, "categoryId");
  const name = text(formData, "name");
  if (!id || !categoryId || !name) return;

  const existing = await prisma.item.findUnique({ where: { id } });
  if (!existing) return;

  const saved = await resolveImage(formData);
  if (saved && "error" in saved) {
    redirect(`/admin/items/${id}?error=${encodeURIComponent(saved.error)}`);
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
  revalidatePath(`/admin/categories/${categoryId}`);
  if (existing.categoryId !== categoryId) revalidatePath(`/admin/categories/${existing.categoryId}`);
  redirect(`/admin/categories/${categoryId}`);
}

export async function toggleItemAvailable(formData: FormData) {
  const id = text(formData, "id");
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return;

  await prisma.item.update({ where: { id }, data: { isAvailable: !item.isAvailable } });

  revalidatePath("/");
  revalidatePath(`/admin/categories/${item.categoryId}`);
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
  revalidatePath(`/admin/categories/${item.categoryId}`);
}

export async function deleteItem(formData: FormData) {
  const id = text(formData, "id");

  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return;

  await deleteImage(item.imageUrl);
  await prisma.item.delete({ where: { id } });

  revalidatePath("/");
  revalidatePath(`/admin/categories/${item.categoryId}`);
  redirect(`/admin/categories/${item.categoryId}`);
}

// ---------------------------------------------------------------- appearance

/**
 * Saves the chosen background. An uploaded photo replaces whatever was there
 * before and the old file is removed, so the folder does not fill up with
 * abandoned backgrounds.
 */
export async function saveAppearance(formData: FormData) {
  const chosen = text(formData, "backgroundId");
  if (!isBackgroundId(chosen)) return;

  const previousUrl =
    (await prisma.setting.findUnique({ where: { key: SETTING_KEYS.backgroundImageUrl } }))?.value ??
    null;

  const saved = await saveImage(formData.get("backgroundImage") as File | null);
  if (saved && "error" in saved) {
    redirect(`/admin/appearance?error=${encodeURIComponent(saved.error)}`);
  }

  const uploadedUrl = saved && "url" in saved ? saved.url : null;
  const imageUrl = uploadedUrl ?? previousUrl;

  // Picking a photo background without ever uploading one would render nothing.
  if (chosen === "custom" && !imageUrl) {
    redirect(`/admin/appearance?error=${encodeURIComponent("Choose a photo to upload first.")}`);
  }

  if (uploadedUrl && previousUrl) await deleteImage(previousUrl);

  await prisma.$transaction([
    prisma.setting.upsert({
      where: { key: SETTING_KEYS.backgroundId },
      create: { key: SETTING_KEYS.backgroundId, value: chosen },
      update: { value: chosen },
    }),
    prisma.setting.upsert({
      where: { key: SETTING_KEYS.backgroundImageUrl },
      create: { key: SETTING_KEYS.backgroundImageUrl, value: imageUrl ?? "" },
      update: { value: imageUrl ?? "" },
    }),
  ]);

  // The whole dashboard wears this background too, so refresh its layout.
  revalidatePath("/admin", "layout");
  redirect("/admin/appearance?saved=1");
}

/** Removes the uploaded photo and falls back to the plain background. */
export async function removeBackgroundImage() {
  const previousUrl =
    (await prisma.setting.findUnique({ where: { key: SETTING_KEYS.backgroundImageUrl } }))?.value ??
    null;

  await deleteImage(previousUrl);

  const current = await prisma.setting.findUnique({ where: { key: SETTING_KEYS.backgroundId } });

  await prisma.$transaction([
    prisma.setting.upsert({
      where: { key: SETTING_KEYS.backgroundImageUrl },
      create: { key: SETTING_KEYS.backgroundImageUrl, value: "" },
      update: { value: "" },
    }),
    prisma.setting.upsert({
      where: { key: SETTING_KEYS.backgroundId },
      create: { key: SETTING_KEYS.backgroundId, value: "plain" },
      // Only reset the choice if the photo was the one being shown.
      update: { value: current?.value === "custom" ? "plain" : (current?.value ?? "plain") },
    }),
  ]);

  // The whole dashboard wears this background too, so refresh its layout.
  revalidatePath("/admin", "layout");
  redirect("/admin/appearance?saved=1");
}

// -------------------------------------------------------------------- hours

/** Saves opening hours and any weekly off days. */
export async function saveHours(formData: FormData) {
  const clear = formData.get("clear") === "1";

  if (clear) {
    await prisma.setting.deleteMany({
      where: { key: { in: [HOURS_KEYS.open, HOURS_KEYS.close, HOURS_KEYS.closedDays] } },
    });
    revalidatePath("/admin/hours");
    redirect("/admin/hours?saved=1");
  }

  const open = text(formData, "open");
  const close = text(formData, "close");

  if (!isValidTime(open) || !isValidTime(close)) {
    redirect(`/admin/hours?error=${encodeURIComponent("Please give both an opening and a closing time.")}`);
  }

  const closedDays = formData
    .getAll("closedDays")
    .map((value) => Number(String(value)))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);

  // Every day off would leave the menu permanently shut, which is never what
  // the owner means — it is a mis-click.
  if (closedDays.length === 7) {
    redirect(`/admin/hours?error=${encodeURIComponent("The shop cannot be closed every day of the week.")}`);
  }

  const rows: [string, string][] = [
    [HOURS_KEYS.open, open],
    [HOURS_KEYS.close, close],
    [HOURS_KEYS.closedDays, closedDays.join(",")],
  ];

  await prisma.$transaction(
    rows.map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } }),
    ),
  );

  revalidatePath("/admin/hours");
  redirect("/admin/hours?saved=1");
}

// -------------------------------------------------------------------- offers

/**
 * Saves the offer / festival strip.
 *
 * Hiding keeps the text: the same Diwali or Sankranti message tends to come
 * back, and retyping it every year is the sort of small friction that stops
 * people using a feature at all.
 */
export async function saveOffer(formData: FormData) {
  const offerText = text(formData, "text").slice(0, MAX_OFFER_TEXT);
  const note = text(formData, "note").slice(0, MAX_OFFER_NOTE);
  const tone = text(formData, "tone");
  const isVisible = checked(formData, "isVisible");

  if (!offerText) {
    redirect(`/admin/offers?error=${encodeURIComponent("Write the offer text first.")}`);
  }

  const rows: [string, string][] = [
    [OFFER_KEYS.text, offerText],
    [OFFER_KEYS.note, note],
    [OFFER_KEYS.tone, isOfferTone(tone) ? tone : "festive"],
    [OFFER_KEYS.isVisible, isVisible ? "true" : "false"],
  ];

  await prisma.$transaction(
    rows.map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } }),
    ),
  );

  revalidatePath("/admin/offers");
  redirect("/admin/offers?saved=1");
}

/** Removes the offer entirely, text and all. */
export async function removeOffer() {
  await prisma.setting.deleteMany({
    where: { key: { in: [OFFER_KEYS.text, OFFER_KEYS.note, OFFER_KEYS.tone, OFFER_KEYS.isVisible] } },
  });

  revalidatePath("/admin/offers");
  redirect("/admin/offers?saved=1");
}

// ------------------------------------------------------------------ ordering

/**
 * Saves the WhatsApp ordering switches. Refuses a setup that would switch
 * ordering on but leave customers unable to order — no way to order, or no
 * number for the orders to go to — rather than saving it and showing a menu
 * whose Order button goes nowhere.
 */
export async function saveOrdering(formData: FormData) {
  function fail(message: string): never {
    redirect(`/admin/ordering?error=${encodeURIComponent(message)}`);
  }

  const enabled = checked(formData, "enabled");
  const modes = Object.fromEntries(ORDER_MODES.map((mode) => [mode, checked(formData, mode)]));
  const tables = Number(text(formData, "tables"));
  const tablesValid = Number.isInteger(tables) && tables >= 1 && tables <= MAX_TABLES;
  const whatsapp = text(formData, "whatsapp");
  const minOrder = Math.round(money(formData, "minOrder"));

  if (modes.table && !tablesValid) fail(`Enter how many tables you have, from 1 to ${MAX_TABLES}.`);
  if (whatsapp && !isWhatsappNumber(whatsapp)) {
    fail("That WhatsApp number looks too short. Include the country code, like +91 98765 43210.");
  }
  if (enabled && !ORDER_MODES.some((mode) => modes[mode])) {
    fail("Turn on at least one way to order, or switch ordering off.");
  }
  const fallback = process.env.SHOP_WHATSAPP || process.env.SHOP_PHONE || "";
  if (enabled && !whatsapp && !isWhatsappNumber(fallback)) {
    fail("Add the WhatsApp number orders should go to.");
  }

  const payments = PAYMENT_METHODS.filter((method) => checked(formData, `pay_${method}`));
  const upiId = text(formData, "upiId");
  if (upiId && !isUpiId(upiId)) fail("That UPI ID doesn't look right. It should be like shivambakery@okaxis.");

  // The QR image: a new upload replaces the old one, or the owner removes it.
  const previousQr =
    (await prisma.setting.findUnique({ where: { key: ORDERING_KEYS.upiQr } }))?.value ?? "";
  const uploaded = await saveImage(formData.get("upiQr") as File | null);
  if (uploaded && "error" in uploaded) fail(uploaded.error);
  let upiQr = uploaded && "url" in uploaded ? uploaded.url : previousQr;
  if (!uploaded && checked(formData, "removeUpiQr")) upiQr = "";

  if (enabled && payments.includes("upi") && !upiId && !upiQr) {
    fail("Add your UPI ID or upload your UPI QR code, so customers who choose UPI can pay you.");
  }
  if (previousQr && previousQr !== upiQr) await deleteImage(previousQr);

  const rows: [string, string][] = [
    [ORDERING_KEYS.enabled, enabled ? "1" : "0"],
    ...ORDER_MODES.map((mode): [string, string] => [ORDERING_KEYS[mode], modes[mode] ? "1" : "0"]),
    [ORDERING_KEYS.whatsapp, whatsapp],
    [ORDERING_KEYS.minOrder, String(minOrder)],
    [ORDERING_KEYS.onlyWhenOpen, checked(formData, "onlyWhenOpen") ? "1" : "0"],
    [ORDERING_KEYS.payments, payments.join(",")],
    [ORDERING_KEYS.upiId, upiId],
    [ORDERING_KEYS.upiQr, upiQr],
  ];
  // With table orders off the box may be empty; keep whatever was saved before.
  if (tablesValid) rows.push([ORDERING_KEYS.tables, String(tables)]);

  await prisma.$transaction(
    rows.map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } }),
    ),
  );

  // The menu shows or hides its Order tab from these.
  revalidatePath("/");
  revalidatePath("/admin/ordering");
  redirect("/admin/ordering?saved=1");
}

// --------------------------------------------------------------------- orders

/** Moves an order along: preparing, ready, completed, cancelled, or back to new. */
export async function setOrderStatus(formData: FormData) {
  const id = text(formData, "id");
  const status = text(formData, "status");
  if (!id || !isOrderStatus(status)) return;

  await prisma.order.update({ where: { id }, data: { status } });
  revalidatePath("/admin/orders");
}

/** Marks an order paid once the money is in — cash in the drawer, UPI in the bank app. */
export async function setOrderPaid(formData: FormData) {
  const id = text(formData, "id");
  if (!id) return;

  await prisma.order.update({ where: { id }, data: { paid: formData.get("paid") === "1" } });
  revalidatePath("/admin/orders");
}
