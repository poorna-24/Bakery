import { prisma } from "@/lib/db";
import { json, toApiItem } from "@/lib/api";
import { getShop } from "@/lib/shop";

export const dynamic = "force-dynamic";

/**
 * The whole menu in one call — shop details plus every visible category with
 * its items. This is what the menu page itself renders, so anything built on
 * this endpoint shows exactly what a customer sees.
 */
export async function GET() {
  const [shop, categories] = await Promise.all([
    getShop(),
    prisma.category.findMany({
      where: { isVisible: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        items: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: { variants: { orderBy: { sortOrder: "asc" } }, category: true },
        },
      },
    }),
  ]);

  return json({
    shop,
    // An empty category is hidden from customers, so it is absent here too.
    categories: categories
      .filter((category) => category.items.length > 0)
      .map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        items: category.items.map(toApiItem),
      })),
  });
}
