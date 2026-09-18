// Shared file. An identical copy lives in bakery-admin/lib/types.ts.
// These are the shapes that travel between the database and the UI in both apps.

export type Variant = {
  id: string;
  label: string;
  price: number;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  imageUrl: string | null;
  isVeg: boolean;
  isEggless: boolean;
  isBestseller: boolean;
  isAvailable: boolean;
  variants: Variant[];
};

export type MenuCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
  items: MenuItem[];
};

export const UNITS = [
  "per piece",
  "per kg",
  "per 500 g",
  "per dozen",
  "per half dozen",
  "per plate",
  "per glass",
  "per box",
  "per pack",
] as const;

/** Turns "Breads, Dry Cakes & Biscuits" into "breads-dry-cakes-biscuits". */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** 650 -> "₹650", 649.5 -> "₹649.50" */
export function formatPrice(value: number): string {
  const hasPaise = Math.round(value * 100) % 100 !== 0;
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * "₹350 – ₹650" across sizes, or just "₹350" when every size costs the same
 * (or there is only one). Null when the item has no variants at all.
 */
export function variantRange(variants: { price: number }[]): string | null {
  if (variants.length === 0) return null;

  const prices = variants.map((variant) => variant.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  return low === high ? formatPrice(low) : `${formatPrice(low)} – ${formatPrice(high)}`;
}

/**
 * What the customer sees on a card. With variants we show the range,
 * otherwise the base price plus its unit.
 */
export function priceLabel(item: MenuItem): string {
  return variantRange(item.variants) ?? `${formatPrice(item.price)} ${item.unit}`;
}
