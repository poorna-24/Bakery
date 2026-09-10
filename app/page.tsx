import { prisma } from "@/lib/db";
import type { MenuCategory } from "@/lib/types";
import { toAppearance } from "@/lib/backgrounds";
import { shopNow, shopStatus, toShopHours } from "@/lib/hours";
import { toOffer } from "@/lib/offer";
import Menu from "@/components/Menu";

// The owner edits the menu in the admin app, which writes to the same database.
// Re-reading on every request means a saved change is live on the next scan.
export const dynamic = "force-dynamic";

async function getMenu(): Promise<MenuCategory[]> {
  const categories = await prisma.category.findMany({
    where: { isVisible: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      items: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { variants: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  // A category with nothing in it would render as a blank heading, so drop it.
  return categories
    .filter((category) => category.items.length > 0)
    .map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      items: category.items.map((item) => ({
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
      })),
    }));
}

export default async function MenuPage() {
  const [categories, settingRows] = await Promise.all([
    getMenu(),
    prisma.setting.findMany(),
  ]);
  const appearance = toAppearance(settingRows);

  // Worked out here so the first paint is already right; OpenStatus keeps it
  // current from the browser after that.
  const offer = toOffer(settingRows);
  const hours = toShopHours(settingRows);
  const hoursStatus = hours ? shopStatus(hours, shopNow()) : null;

  return (
    <Menu
      categories={categories}
      shopName={process.env.NEXT_PUBLIC_SHOP_NAME ?? "Our Bakery"}
      tagline={process.env.NEXT_PUBLIC_SHOP_TAGLINE ?? "Freshly baked every morning."}
      address={process.env.NEXT_PUBLIC_SHOP_ADDRESS ?? ""}
      mapUrl={process.env.NEXT_PUBLIC_SHOP_MAP_URL ?? ""}
      phone={process.env.NEXT_PUBLIC_SHOP_PHONE ?? ""}
      whatsapp={process.env.NEXT_PUBLIC_SHOP_WHATSAPP ?? ""}
      credit={{
        name: process.env.NEXT_PUBLIC_CREDIT_NAME ?? "",
        whatsapp: process.env.NEXT_PUBLIC_CREDIT_WHATSAPP ?? "",
      }}
      appearance={appearance}
      hours={hours}
      hoursStatus={hoursStatus}
      offer={offer}
    />
  );
}
