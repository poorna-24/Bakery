import Link from "next/link";
import { prisma } from "@/lib/db";
import Shell from "@/components/Shell";
import CategoryRow from "@/components/CategoryRow";
import NewCategoryForm from "@/components/NewCategoryForm";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { items: true } } },
  });

  const [itemCount, soldOutCount] = await Promise.all([
    prisma.item.count(),
    prisma.item.count({ where: { isAvailable: false } }),
  ]);

  return (
    <Shell title="Menu">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Categories" value={categories.length} />
        <Stat label="Items" value={itemCount} />
        <Stat label="Sold out" value={soldOutCount} tone={soldOutCount > 0 ? "warn" : undefined} />
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Categories
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          The order here is the order customers see. A category with no items is hidden from them
          automatically.
        </p>

        <div className="card mt-3 divide-y divide-[var(--line)]">
          {categories.length === 0 ? (
            <p className="p-6 text-center text-sm text-[var(--muted)]">
              No categories yet. Add your first one below — say, “Cakes”.
            </p>
          ) : (
            categories.map((category, index) => (
              <CategoryRow
                key={category.id}
                category={{
                  id: category.id,
                  name: category.name,
                  description: category.description,
                  isVisible: category.isVisible,
                  itemCount: category._count.items,
                }}
                isFirst={index === 0}
                isLast={index === categories.length - 1}
                otherCategories={categories
                  .filter((other) => other.id !== category.id)
                  .map((other) => ({ id: other.id, name: other.name }))}
              />
            ))
          )}
        </div>
      </div>

      <NewCategoryForm />

      <p className="mt-8 text-center text-sm text-[var(--muted)]">
        Want to see what customers see?{" "}
        <Link href="/preview" className="font-medium text-[var(--accent)] hover:underline">
          Open the phone preview
        </Link>
      </p>
    </Shell>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone === "warn" ? "text-[var(--danger)]" : ""}`}>
        {value}
      </p>
    </div>
  );
}
