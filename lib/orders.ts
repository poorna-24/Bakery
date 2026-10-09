import type { MenuItem } from "./types";
import { SHOP_TIME_ZONE } from "./hours";
import {
  MAX_QTY,
  ORDER_MODES,
  WHEN_OPTIONS,
  isGeoPoint,
  lineKey,
  mapsLink,
  type Cart,
  type OrderDetails,
  type OrderMode,
} from "./ordering";

// Orders saved for the dashboard: taking one in from a customer's phone, and
// everything the Orders page works out from them.
//
// The owner may never open the dashboard — WhatsApp is where orders get dealt
// with. So nothing here depends on anyone updating a status: an order left
// untouched simply counts as completed once its day is over.

// ------------------------------------------------------------- taking orders in

export const MAX_LINES = 50;

/** One line as the phone sends it: what and how many, never a price. */
export type RequestedLine = { itemId: string; size: string | null; qty: number };

export type OrderRequest = { lines: RequestedLine[]; details: OrderDetails };

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/**
 * Reads an order posted from the menu. Anything malformed is refused outright;
 * whether the order makes sense for the shop (table numbers, names, minimums)
 * is checked separately against the shop's settings.
 */
export function parseOrderRequest(body: unknown): OrderRequest | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "That order could not be read." };
  const { lines, details } = body as Record<string, unknown>;

  if (!Array.isArray(lines) || lines.length === 0) return { error: "Add something to your order first." };
  if (lines.length > MAX_LINES) return { error: "That order has too many lines." };

  const parsedLines: RequestedLine[] = [];
  for (const line of lines) {
    if (typeof line !== "object" || line === null) return { error: "That order could not be read." };
    const { itemId, size, qty } = line as Record<string, unknown>;
    if (
      typeof itemId !== "string" ||
      !itemId ||
      !(size === null || typeof size === "string") ||
      !Number.isInteger(qty) ||
      (qty as number) < 1 ||
      (qty as number) > MAX_QTY
    ) {
      return { error: "That order could not be read." };
    }
    parsedLines.push({ itemId, size, qty: qty as number });
  }

  if (typeof details !== "object" || details === null) return { error: "That order could not be read." };
  const raw = details as Record<string, unknown>;
  if (typeof raw.mode !== "string" || !(ORDER_MODES as readonly string[]).includes(raw.mode)) {
    return { error: "Choose how you'd like your order." };
  }

  const when = text(raw.when, 40);
  return {
    lines: parsedLines,
    details: {
      mode: raw.mode as OrderMode,
      table: text(raw.table, 5),
      name: text(raw.name, 60),
      phone: text(raw.phone, 20),
      address: text(raw.address, 300),
      when: (WHEN_OPTIONS as readonly string[]).includes(when) ? when : WHEN_OPTIONS[0],
      note: text(raw.note, 300),
      payment: text(raw.payment, 10),
      location: isGeoPoint(raw.location) ? raw.location : null,
    },
  };
}

/**
 * Prices an order from the menu as it stands now. The phone never says what
 * anything costs — a price edited in the browser must not reach the shop.
 */
export function priceOrder(lines: RequestedLine[], items: MenuItem[]): Cart | { error: string } {
  const byId = new Map(items.map((item) => [item.id, item]));
  const cart: Cart = [];

  for (const line of lines) {
    const item = byId.get(line.itemId);
    if (!item) return { error: "Something in your order is no longer on the menu. Please check it." };
    if (!item.isAvailable) return { error: `${item.name} is sold out right now.` };

    let price = item.price;
    if (item.variants.length > 0) {
      const variant = item.variants.find((entry) => entry.label === line.size);
      if (!variant) return { error: `Choose a size for ${item.name}.` };
      price = variant.price;
    } else if (line.size !== null) {
      return { error: "Something in your order is no longer on the menu. Please check it." };
    }

    const key = lineKey(item.id, line.size);
    const existing = cart.find((entry) => entry.key === key);
    if (existing) existing.qty = Math.min(MAX_QTY, existing.qty + line.qty);
    else cart.push({ key, itemId: item.id, name: item.name, size: line.size, price, qty: line.qty });
  }

  return cart;
}

// ------------------------------------------------------------------- statuses

export const ORDER_STATUSES = ["new", "preparing", "ready", "completed", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "New",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

/** Still being dealt with: not completed, not cancelled. */
export function isOpen(status: OrderStatus): boolean {
  return status === "new" || status === "preparing" || status === "ready";
}

export type StoredOrder = {
  id: string;
  code: string;
  mode: string;
  tableNo: number | null;
  name: string;
  phone: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  whenText: string;
  note: string;
  payment: string;
  paid: boolean;
  status: string;
  total: number;
  createdAt: Date;
  lines: { itemId: string; name: string; size: string | null; price: number; qty: number }[];
};

/**
 * The status to show and count. An order nobody touched by the end of its day
 * was served — the owner dealt with it on WhatsApp — so it counts as completed
 * rather than sitting in "New" forever.
 */
export function effectiveStatus(order: StoredOrder, todayStart: Date): OrderStatus {
  const status = isOrderStatus(order.status) ? order.status : "new";
  return isOpen(status) && order.createdAt < todayStart ? "completed" : status;
}

/** "Table 3", "Counter · Ravi", "Delivery · Ravi". */
export function whereLabel(order: StoredOrder): string {
  switch (order.mode) {
    case "table":
      return `Table ${order.tableNo}`;
    case "counter":
      return `Counter · ${order.name}`;
    case "pickup":
      return `Pickup · ${order.name}`;
    default:
      return `Delivery · ${order.name}`;
  }
}

/** Directions for a delivery: the shared spot when there is one, else a search for the address. */
export function orderMapsLink(order: StoredOrder): string | null {
  if (order.latitude !== null && order.longitude !== null) {
    return mapsLink({ lat: order.latitude, lng: order.longitude });
  }
  if (order.address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`;
  }
  return null;
}

// ------------------------------------------------------------------- periods

export const PERIODS = { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days" } as const;
export type Period = keyof typeof PERIODS;

export function isPeriod(value: string): value is Period {
  return value in PERIODS;
}

function partsIn(at: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
      .formatToParts(at)
      .map((part) => [part.type, Number(part.value)]),
  );
  return parts as Record<"year" | "month" | "day" | "hour" | "minute" | "second", number>;
}

/** Midnight at the shop, `daysAgo` days back from `at` — the start of a dashboard period. */
export function startOfShopDay(at: Date, daysAgo = 0, timeZone = SHOP_TIME_ZONE): Date {
  const p = partsIn(at, timeZone);
  // How far the shop's clock is ahead of UTC right now.
  const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(at.getTime() / 1000) * 1000;
  return new Date(Date.UTC(p.year, p.month - 1, p.day - daysAgo) - offset);
}

export function periodStart(period: Period, now: Date): Date {
  return startOfShopDay(now, period === "today" ? 0 : period === "7d" ? 6 : 29);
}

/** The hour of day at the shop, 0–23. */
export function shopHour(at: Date, timeZone = SHOP_TIME_ZONE): number {
  return partsIn(at, timeZone).hour;
}

/** "2:45 pm" at the shop, plus the date when it was not today. */
export function orderTime(at: Date, todayStart: Date, timeZone = SHOP_TIME_ZONE): string {
  const time = new Intl.DateTimeFormat("en-IN", { timeZone, hour: "numeric", minute: "2-digit", hour12: true })
    .format(at)
    .toLowerCase();
  if (at >= todayStart) return time;
  const day = new Intl.DateTimeFormat("en-IN", { timeZone, day: "numeric", month: "short" }).format(at);
  return `${day}, ${time}`;
}

// ------------------------------------------------------------------- analysis

export type OrderSummary = {
  /** Orders that went ahead: everything but cancelled. */
  orders: number;
  sales: number;
  average: number;
  /** Today's orders still new, preparing or ready. */
  waiting: number;
  /** Money still to collect on orders not marked paid. */
  unpaid: number;
};

export function summarize(orders: StoredOrder[], todayStart: Date): OrderSummary {
  const live = orders.filter((order) => effectiveStatus(order, todayStart) !== "cancelled");
  const sales = live.reduce((total, order) => total + order.total, 0);

  return {
    orders: live.length,
    sales,
    average: live.length ? sales / live.length : 0,
    waiting: orders.filter((order) => isOpen(effectiveStatus(order, todayStart))).length,
    unpaid: live.filter((order) => !order.paid).reduce((total, order) => total + order.total, 0),
  };
}

/** Best sellers by quantity, sizes added together: "Choco Truffle Cake" not "(1 kg)" and "(500 g)". */
export function topItems(orders: StoredOrder[], todayStart: Date, limit = 5): { name: string; qty: number }[] {
  const counts = new Map<string, number>();
  for (const order of orders) {
    if (effectiveStatus(order, todayStart) === "cancelled") continue;
    for (const line of order.lines) counts.set(line.name, (counts.get(line.name) ?? 0) + line.qty);
  }
  return [...counts.entries()]
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** How many orders came each way, in the fixed order of the ways to order. */
export function byMode(orders: StoredOrder[], todayStart: Date): { mode: OrderMode; count: number }[] {
  const live = orders.filter((order) => effectiveStatus(order, todayStart) !== "cancelled");
  return ORDER_MODES.map((mode) => ({ mode, count: live.filter((order) => order.mode === mode).length })).filter(
    (entry) => entry.count > 0,
  );
}

/** Orders per hour of the day, for the busy-hours chart. */
export function byHour(orders: StoredOrder[], todayStart: Date): number[] {
  const hours = Array.from({ length: 24 }, () => 0);
  for (const order of orders) {
    if (effectiveStatus(order, todayStart) === "cancelled") continue;
    hours[shopHour(order.createdAt)] += 1;
  }
  return hours;
}
