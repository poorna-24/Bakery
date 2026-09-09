// Shapes and helpers for the public read-only menu API.
//
// The API returns exactly what the menu page shows — no more. There is nothing
// here a customer could not already read off the page, which is why it needs no
// authentication. Writes stay in the admin app, behind its login.

import type { ShopHours, ShopStatus } from "./hours";

export const API_VERSION = "1.0.0";

export type ApiVariant = {
  id: string;
  label: string;
  price: number;
};

export type ApiItem = {
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
  variants: ApiVariant[];
  categoryId: string;
  categorySlug: string;
};

export type ApiCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
  itemCount: number;
};

export type ApiMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ApiError = {
  error: { code: string; message: string };
};

export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 20;

export type Pagination = { page: number; limit: number; skip: number };

/**
 * Reads `page` and `limit` off a query string.
 *
 * Anything nonsensical falls back to the default rather than erroring: a
 * caller fumbling `?page=abc` should still get the first page, and `limit` is
 * capped so nobody can ask for the whole database in one request.
 */
export function readPagination(params: URLSearchParams): Pagination {
  const rawPage = Number.parseInt(params.get("page") ?? "", 10);
  const rawLimit = Number.parseInt(params.get("limit") ?? "", 10);

  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;

  return { page, limit, skip: (page - 1) * limit };
}

export function buildMeta(total: number, { page, limit }: Pagination): ApiMeta {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export type ShopPayload = {
  name: string;
  tagline: string;
  address: string;
  mapUrl: string;
  phone: string;
  whatsapp: string;
  hours: ShopHours | null;
  status: ShopStatus | null;
};

/** The shape the database rows are turned into before they leave the server. */
export function toApiItem(item: {
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
  categoryId: string;
  category: { slug: string };
  variants: { id: string; label: string; price: number }[];
}): ApiItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    price: item.price,
    unit: item.unit,
    imageUrl: item.imageUrl,
    isVeg: item.isVeg,
    isEggless: item.isEggless,
    isBestseller: item.isBestseller,
    isAvailable: item.isAvailable,
    variants: item.variants.map((variant) => ({
      id: variant.id,
      label: variant.label,
      price: variant.price,
    })),
    categoryId: item.categoryId,
    categorySlug: item.category.slug,
  };
}

/**
 * JSON response with CORS open to everyone.
 *
 * The data is public, and a menu is exactly the sort of thing another site or
 * a future app should be able to read. `no-store` because prices and sold-out
 * flags change during the day and a stale cached menu is worse than a slow one.
 */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}

export function apiError(status: number, code: string, message: string): Response {
  return json({ error: { code, message } } satisfies ApiError, status);
}
