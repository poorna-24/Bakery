"use server";

import { headers } from "next/headers";
import { placeOrder, type PlaceOrderResult } from "@/lib/placeOrder";

/**
 * The menu's "Send order" button. A server action rather than a public API
 * route: Next.js only accepts these from the shop's own pages, so another
 * site cannot post orders into the dashboard. The work is in lib/placeOrder.
 */
export async function submitOrder(body: unknown): Promise<PlaceOrderResult> {
  const list = await headers();
  const ip = list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || "unknown";
  return placeOrder(body, { ip });
}
