import { prisma } from "@/lib/db";
import { buildMeta, json, readPagination, toApiItem } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Items across the whole menu.
 *
 * Filters: `category` (slug), `available` (true/false) and `q` (name or
 * description). A sold-out item is still returned by default — it is on the
 * menu, just not for sale today — so `available=true` is how you exclude it.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const pagination = readPagination(params);

  const categorySlug = params.get("category")?.trim();
  const available = params.get("available");
  const query = params.get("q")?.trim();

  const where = {
    category: { isVisible: true, ...(categorySlug ? { slug: categorySlug } : {}) },
    ...(available === "true" ? { isAvailable: true } : {}),
    ...(available === "false" ? { isAvailable: false } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query } },
            { description: { contains: query } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.item.count({ where }),
    prisma.item.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      skip: pagination.skip,
      take: pagination.limit,
      include: { variants: { orderBy: { sortOrder: "asc" } }, category: true },
    }),
  ]);

  return json({ data: items.map(toApiItem), meta: buildMeta(total, pagination) });
}
