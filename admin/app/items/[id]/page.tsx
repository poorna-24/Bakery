import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import Shell from "@/components/Shell";
import ItemForm from "@/components/ItemForm";

export const dynamic = "force-dynamic";

export default async function EditItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const [item, categories] = await Promise.all([
    prisma.item.findUnique({
      where: { id },
      include: { variants: { orderBy: { sortOrder: "asc" } }, category: true },
    }),
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);

  if (!item) notFound();

  return (
    <Shell
      title={item.name}
      back={{ href: `/categories/${item.categoryId}`, label: item.category.name }}
    >
      <ItemForm
        error={error}
        categories={categories.map((entry) => ({ id: entry.id, name: entry.name }))}
        values={{
          id: item.id,
          categoryId: item.categoryId,
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
            label: variant.label,
            price: variant.price,
          })),
        }}
      />
    </Shell>
  );
}
