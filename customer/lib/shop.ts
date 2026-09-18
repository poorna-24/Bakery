import { prisma } from "@/lib/db";
import { shopNow, shopStatus, toShopHours } from "@/lib/hours";
import type { ShopPayload } from "@/lib/api";

/**
 * The shop's own details: half from the environment (things the owner sets
 * once) and half from the settings table (things they change from the admin).
 * Used by the API and by the page, so the two can never disagree.
 */
export async function getShop(): Promise<ShopPayload> {
  const rows = await prisma.setting.findMany();
  const hours = toShopHours(rows);

  return {
    name: process.env.SHOP_NAME ?? "Our Bakery",
    tagline: process.env.SHOP_TAGLINE ?? "",
    address: process.env.SHOP_ADDRESS ?? "",
    mapUrl: process.env.SHOP_MAP_URL ?? "",
    phone: process.env.SHOP_PHONE ?? "",
    whatsapp: process.env.SHOP_WHATSAPP ?? "",
    hours,
    status: hours ? shopStatus(hours, shopNow()) : null,
  };
}
