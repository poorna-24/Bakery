import { prisma } from "./db";
import { shopNow, shopStatus, toShopHours } from "./hours";
import {
  cartTotal,
  isPaymentMethod,
  newOrderId,
  orderProblem,
  orderingClosed,
  orderingConfig,
  toOrderingSettings,
  type Cart,
} from "./ordering";
import { parseOrderRequest, priceOrder, type OrderRequest } from "./orders";
import { createRateLimiter } from "./rateLimit";

export type PlaceOrderResult =
  | { ok: true; code: string; cart: Cart; total: number }
  /**
   * `fallback` means the order was fine but could not be saved — the
   * database is down, or not set up. The customer can still send it on
   * WhatsApp; the shop just won't see it in the dashboard.
   */
  | { ok: false; error: string; fallback?: boolean };

// Twenty orders in ten minutes from one address: plenty for a busy shop on
// one Wi-Fi, far too few to flood the dashboard.
const allow = createRateLimiter({ limit: 20, windowMs: 10 * 60 * 1000 });

/**
 * Saves an order sent from the menu, after checking it the same way the phone
 * did — but against the database, never the phone's word: ordering must be
 * switched on, the shop open if the owner requires it, every item on sale,
 * and every price today's price.
 */
export async function placeOrder(body: unknown, client: { ip: string }): Promise<PlaceOrderResult> {
  if (!allow(client.ip)) {
    return { ok: false, error: "Too many orders from here just now. Please wait a few minutes." };
  }

  const request = parseOrderRequest(body);
  if ("error" in request) return { ok: false, error: request.error };

  try {
    return await checkAndSave(request);
  } catch (error) {
    // Logged for the owner (Vercel → Logs); the customer gets a way forward.
    console.error("Saving an order failed:", error);
    return {
      ok: false,
      fallback: true,
      error: "We couldn't save your order just now. You can still send it to us on WhatsApp.",
    };
  }
}

async function checkAndSave(request: OrderRequest): Promise<PlaceOrderResult> {
  const settingRows = await prisma.setting.findMany();
  const config = orderingConfig(
    toOrderingSettings(settingRows),
    process.env.SHOP_WHATSAPP || process.env.SHOP_PHONE || "",
  );
  if (!config) return { ok: false, error: "The shop isn't taking orders here right now." };

  const hours = toShopHours(settingRows);
  if (orderingClosed(config, hours ? shopStatus(hours, shopNow()) : null)) {
    return { ok: false, error: "We're closed right now. Please send your order once we open." };
  }

  const items = await prisma.item.findMany({
    where: { id: { in: request.lines.map((line) => line.itemId) }, category: { isVisible: true } },
    include: { variants: { orderBy: { sortOrder: "asc" } } },
  });
  const cart = priceOrder(request.lines, items);
  if ("error" in cart) return { ok: false, error: cart.error };

  const problem = orderProblem(config, cart, request.details);
  if (problem) return { ok: false, error: problem };

  const { details } = request;
  const total = cartTotal(cart);
  // Only a delivery needs to know where the customer is.
  const point = details.mode === "delivery" ? details.location : null;

  // Codes are short, so one could repeat; try again with a fresh one if so.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newOrderId();
    const clash = await prisma.order.findUnique({ where: { code }, select: { id: true } });
    if (clash) continue;

    await prisma.order.create({
      data: {
        code,
        mode: details.mode,
        tableNo: details.mode === "table" ? Number(details.table) : null,
        name: details.name,
        phone: details.mode === "table" ? "" : details.phone,
        address: details.mode === "delivery" ? details.address : "",
        latitude: point?.lat ?? null,
        longitude: point?.lng ?? null,
        whenText: details.mode === "pickup" || details.mode === "delivery" ? details.when : "",
        note: details.note,
        payment: isPaymentMethod(details.payment) ? details.payment : "",
        total,
        lines: {
          create: cart.map((line) => ({
            itemId: line.itemId,
            name: line.name,
            size: line.size,
            price: line.price,
            qty: line.qty,
          })),
        },
      },
    });

    return { ok: true, code, cart, total };
  }

  return { ok: false, error: "Couldn't save your order. Please try again." };
}
