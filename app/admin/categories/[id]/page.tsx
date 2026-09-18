import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatPrice, variantRange } from "@/lib/types";
import Shell from "@/components/admin/Shell";
import ItemRow from "@/components/admin/ItemRow";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { variants: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  if (!category) notFound();

  return (
    <Shell
      title={category.name}
      back={{ href: "/admin", label: "All categories" }}
      action={
        <Link href={`/admin/categories/${category.id}/new`} className="btn-primary">
          + Add item
        </Link>
      }
    >
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">{error}</p>
      )}

      {category.items.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-medium">No items in this category yet.</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Until you add one, customers will not see “{category.name}” on the menu at all.
          </p>
          <Link href={`/admin/categories/${category.id}/new`} className="btn-primary mt-4">
            Add the first item
          </Link>
        </div>
      ) : (
        <div className="card divide-y divide-[var(--line)]">
          {category.items.map((item, index) => (
            <ItemRow
              key={item.id}
              item={{
                id: item.id,
                name: item.name,
                imageUrl: item.imageUrl,
                isAvailable: item.isAvailable,
                isVeg: item.isVeg,
                isEggless: item.isEggless,
                isBestseller: item.isBestseller,
                priceText:
                  variantRange(item.variants) ?? `${formatPrice(item.price)} ${item.unit}`,
              }}
              isFirst={index === 0}
              isLast={index === category.items.length - 1}
            />
          ))}
        </div>
      )}
    </Shell>
  );
}
