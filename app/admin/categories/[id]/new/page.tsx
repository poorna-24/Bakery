import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import Shell from "@/components/admin/Shell";
import ItemForm from "@/components/admin/ItemForm";

export const dynamic = "force-dynamic";

export default async function NewItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const [category, categories] = await Promise.all([
    prisma.category.findUnique({ where: { id } }),
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);

  if (!category) notFound();

  return (
    <Shell title="New item" back={{ href: `/admin/categories/${id}`, label: category.name }}>
      <ItemForm
        error={error}
        categories={categories.map((entry) => ({ id: entry.id, name: entry.name }))}
        values={{
          categoryId: id,
          name: "",
          description: "",
          price: 0,
          unit: "per piece",
          imageUrl: null,
          isVeg: true,
          isEggless: false,
          isBestseller: false,
          isAvailable: true,
          variants: [],
        }}
      />
    </Shell>
  );
}
