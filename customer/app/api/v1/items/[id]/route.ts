import { prisma } from "@/lib/db";
import { apiError, json, toApiItem } from "@/lib/api";

export const dynamic = "force-dynamic";

/** One item by id. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const item = await prisma.item.findUnique({
    where: { id },
    include: { variants: { orderBy: { sortOrder: "asc" } }, category: true },
  });

  // A hidden category is not public, so its items are not either.
  if (!item || !item.category.isVisible) {
    return apiError(404, "ITEM_NOT_FOUND", `No item exists with id "${id}".`);
  }

  return json(toApiItem(item));
}
