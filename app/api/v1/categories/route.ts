import { prisma } from "@/lib/db";
import { buildMeta, json, readPagination } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Visible categories, in the order customers see them. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const pagination = readPagination(params);

  const where = { isVisible: true };

  const [total, categories] = await Promise.all([
    prisma.category.count({ where }),
    prisma.category.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      skip: pagination.skip,
      take: pagination.limit,
      include: { _count: { select: { items: true } } },
    }),
  ]);

  return json({
    data: categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      itemCount: category._count.items,
    })),
    meta: buildMeta(total, pagination),
  });
}
