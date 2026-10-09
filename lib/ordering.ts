import { formatPrice, type MenuCategory } from "./types";
import { normalisePhone, whatsappHref } from "./contact";
import type { ShopStatus } from "./hours";

// WhatsApp ordering: customers build an order on the menu and send it to the
// shop as a ready-typed WhatsApp message. Nothing is stored on our side — the
// order lives in the shop's WhatsApp, and the owner replies there.
//
// Everything the owner can switch on or off is a row in the Setting table,
// edited on the dashboard's Ordering page. Off by default: a menu that starts
// taking orders must be the owner's decision, not a side effect of a deploy.

export const ORDERING_KEYS = {
  enabled: "ordering.enabled",
  table: "ordering.table",
  counter: "ordering.counter",
  pickup: "ordering.pickup",
  delivery: "ordering.delivery",
  tables: "ordering.tables",
  whatsapp: "ordering.whatsapp",
  minOrder: "ordering.minOrder",
  onlyWhenOpen: "ordering.onlyWhenOpen",
  payments: "ordering.payments",
  upiId: "ordering.upiId",
  upiQr: "ordering.upiQr",
} as const;

/** Where the customer is: in the shop at a table or the counter, or ordering ahead. */
export const ORDER_MODES = ["table", "counter", "pickup", "delivery"] as const;
export type OrderMode = (typeof ORDER_MODES)[number];

export const MODE_LABELS: Record<OrderMode, { title: string; hint: string }> = {
  table: { title: "I'm at a table", hint: "We'll bring it to you" },
  counter: { title: "I'm at the counter", hint: "We'll call your name" },
  pickup: { title: "Pick up later", hint: "Collect it from the shop" },
  delivery: { title: "Delivery", hint: "We'll bring it to your address" },
};

/** How the customer will pay. Nothing is charged online: this tells the shop what to expect. */
export const PAYMENT_METHODS = ["cash", "upi", "card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

/** What the customer reads in the dropdown, and the shop reads on the order. */
export function paymentLabel(method: PaymentMethod, mode?: OrderMode): string {
  if (method === "cash") return mode === "delivery" ? "Cash on delivery" : "Cash";
  if (method === "upi") return "UPI (GPay / PhonePe / Paytm)";
  return "Card";
}

/** A UPI ID like "shivambakery@okaxis". */
export function isUpiId(value: string): boolean {
  return /^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(value);
}

/** For pickup and delivery, when the customer wants it. */
export const WHEN_OPTIONS = [
  "As soon as possible",
  "In 30 minutes",
  "In 1 hour",
  "This evening",
  "Tomorrow",
] as const;

export const MAX_TABLES = 200;

export type OrderingSettings = {
  enabled: boolean;
  modes: Record<OrderMode, boolean>;
  /** How many tables the shop has; the customer picks from 1 to this. */
  tables: number;
  /** The number orders go to. Empty means the shop's WhatsApp from the environment. */
  whatsapp: string;
  /** Smallest order total accepted, in rupees. 0 means no minimum. */
  minOrder: number;
  /** Refuse orders while Shop hours say the shop is closed. */
  onlyWhenOpen: boolean;
  /** Ways to pay the customer can pick from. Empty means the question is not asked. */
  payments: PaymentMethod[];
  /** The shop's UPI ID; set, it gives UPI payers a one-tap pay button. */
  upiId: string;
  /** Address of the shop's UPI QR image, shown to UPI payers who cannot tap a link. */
  upiQr: string;
};

export const DEFAULT_ORDERING: OrderingSettings = {
  enabled: false,
  modes: { table: true, counter: true, pickup: false, delivery: false },
  tables: 8,
  whatsapp: "",
  minOrder: 0,
  onlyWhenOpen: true,
  payments: ["cash", "upi", "card"],
  upiId: "",
  upiQr: "",
};

/** Stored rows to settings, falling back to the defaults for anything unset or garbled. */
export function toOrderingSettings(rows: { key: string; value: string }[]): OrderingSettings {
  const map = new Map(rows.map((row) => [row.key, row.value]));

  const flag = (key: string, fallback: boolean) => {
    const value = map.get(key);
    return value === undefined ? fallback : value === "1";
  };
  const whole = (key: string, fallback: number, max: number) => {
    const value = Number(map.get(key));
    return Number.isInteger(value) && value >= 0 && value <= max ? value : fallback;
  };

  return {
    enabled: flag(ORDERING_KEYS.enabled, DEFAULT_ORDERING.enabled),
    modes: {
      table: flag(ORDERING_KEYS.table, DEFAULT_ORDERING.modes.table),
      counter: flag(ORDERING_KEYS.counter, DEFAULT_ORDERING.modes.counter),
      pickup: flag(ORDERING_KEYS.pickup, DEFAULT_ORDERING.modes.pickup),
      delivery: flag(ORDERING_KEYS.delivery, DEFAULT_ORDERING.modes.delivery),
    },
    tables: whole(ORDERING_KEYS.tables, DEFAULT_ORDERING.tables, MAX_TABLES),
    whatsapp: map.get(ORDERING_KEYS.whatsapp)?.trim() ?? "",
    minOrder: whole(ORDERING_KEYS.minOrder, DEFAULT_ORDERING.minOrder, 1_000_000),
    onlyWhenOpen: flag(ORDERING_KEYS.onlyWhenOpen, DEFAULT_ORDERING.onlyWhenOpen),
    payments: paymentsFrom(map.get(ORDERING_KEYS.payments)),
    upiId: upiFrom(map.get(ORDERING_KEYS.upiId)),
    upiQr: map.get(ORDERING_KEYS.upiQr)?.trim() ?? "",
  };
}

function paymentsFrom(stored: string | undefined): PaymentMethod[] {
  if (stored === undefined) return [...DEFAULT_ORDERING.payments];
  // Kept in the fixed order, whatever order they were saved in.
  const chosen = stored.split(",").map((part) => part.trim());
  return PAYMENT_METHODS.filter((method) => chosen.includes(method));
}

function upiFrom(stored: string | undefined): string {
  const value = stored?.trim() ?? "";
  return isUpiId(value) ? value : "";
}

/** What the customer's menu needs to take orders. */
export type OrderingConfig = {
  modes: OrderMode[];
  tables: number;
  whatsapp: string;
  minOrder: number;
  onlyWhenOpen: boolean;
  payments: PaymentMethod[];
  upiId: string;
  upiQr: string;
};

/** A phone number with at least ten digits, however it is written: enough to call back. */
export function isPhoneNumber(raw: string): boolean {
  return normalisePhone(raw).replace(/^\+/, "").length >= 10;
}

/** A number WhatsApp can open a chat with: the same ten-digit rule. */
export function isWhatsappNumber(raw: string): boolean {
  return isPhoneNumber(raw);
}

/**
 * Orders that ask for a phone number: everything except a table order. The
 * counter crowd moves around — a call or a WhatsApp reaches them when their
 * order is ready — and for pickup and delivery they are not in the shop at all.
 */
export function needsPhone(mode: OrderMode): boolean {
  return mode !== "table";
}

/** Orders for later, which ask when the customer wants them. */
export function needsTime(mode: OrderMode): boolean {
  return mode === "pickup" || mode === "delivery";
}

/**
 * The live ordering setup, or null when the menu should not take orders: the
 * owner has it switched off, no way to order is on, or there is no number to
 * send orders to. Null shows the plain menu, exactly as before ordering existed.
 */
export function orderingConfig(
  settings: OrderingSettings,
  fallbackWhatsapp: string,
): OrderingConfig | null {
  if (!settings.enabled) return null;

  const whatsapp = isWhatsappNumber(settings.whatsapp) ? settings.whatsapp : fallbackWhatsapp;
  if (!isWhatsappNumber(whatsapp)) return null;

  const modes = ORDER_MODES.filter(
    (mode) => settings.modes[mode] && (mode !== "table" || settings.tables > 0),
  );
  if (modes.length === 0) return null;

  return {
    modes,
    tables: settings.tables,
    whatsapp,
    minOrder: settings.minOrder,
    onlyWhenOpen: settings.onlyWhenOpen,
    payments: settings.payments,
    upiId: settings.upiId,
    upiQr: settings.upiQr,
  };
}

/** True when orders should be refused because the shop is shut. Unknown hours never block. */
export function orderingClosed(config: OrderingConfig, status: ShopStatus | null): boolean {
  return config.onlyWhenOpen && status !== null && !status.isOpen;
}

// ------------------------------------------------------------------------ cart

export type CartLine = {
  /** Item id plus the size, so 500 g and 1 kg of one cake are separate lines. */
  key: string;
  itemId: string;
  name: string;
  /** The size label ("1 kg"), or null for an item sold one way. */
  size: string | null;
  price: number;
  qty: number;
};

export type Cart = CartLine[];

export const MAX_QTY = 99;

export function lineKey(itemId: string, size: string | null): string {
  return size ? `${itemId}::${size}` : itemId;
}

export function addToCart(
  cart: Cart,
  line: { itemId: string; name: string; size: string | null; price: number },
): Cart {
  const key = lineKey(line.itemId, line.size);
  const existing = cart.find((entry) => entry.key === key);
  if (existing) return changeQty(cart, key, 1);
  return [...cart, { ...line, key, qty: 1 }];
}

/** Adds `delta` to a line; a line that reaches zero leaves the cart. */
export function changeQty(cart: Cart, key: string, delta: number): Cart {
  return cart
    .map((line) =>
      line.key === key ? { ...line, qty: Math.min(MAX_QTY, line.qty + delta) } : line,
    )
    .filter((line) => line.qty > 0);
}

export function cartCount(cart: Cart): number {
  return cart.reduce((total, line) => total + line.qty, 0);
}

export function cartTotal(cart: Cart): number {
  return cart.reduce((total, line) => total + line.price * line.qty, 0);
}

/** How many of this item, in this size, are in the cart. */
export function qtyOf(cart: Cart, itemId: string, size: string | null): number {
  return cart.find((line) => line.key === lineKey(itemId, size))?.qty ?? 0;
}

/**
 * Brings a remembered cart in line with today's menu. A cart restored from the
 * phone can be days old: items get removed or sold out, and prices change. The
 * order must never quote a price the menu no longer shows.
 */
export function reconcileCart(cart: Cart, categories: MenuCategory[]): Cart {
  const items = new Map(categories.flatMap((category) => category.items).map((item) => [item.id, item]));

  return cart.flatMap((line) => {
    const item = items.get(line.itemId);
    if (!item || !item.isAvailable) return [];

    if (line.size === null) {
      return item.variants.length === 0 ? [{ ...line, name: item.name, price: item.price }] : [];
    }

    const variant = item.variants.find((entry) => entry.label === line.size);
    return variant ? [{ ...line, name: item.name, price: variant.price }] : [];
  });
}

export const CART_STORAGE_KEY = "bakery.cart";

/** This phone's localStorage, or undefined where there is none or touching it throws. */
export function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** The cart remembered on this phone, or an empty one if there is none or it is unreadable. */
export function loadCart(storage: Pick<Storage, "getItem"> | undefined): Cart {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(CART_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (line): line is CartLine =>
        typeof line === "object" &&
        line !== null &&
        typeof line.key === "string" &&
        typeof line.itemId === "string" &&
        typeof line.name === "string" &&
        (line.size === null || typeof line.size === "string") &&
        typeof line.price === "number" &&
        Number.isInteger(line.qty) &&
        line.qty > 0,
    );
  } catch {
    // Private mode, blocked storage or a corrupted value: start afresh.
    return [];
  }
}

/** Remembers the cart on this phone. Best effort — a phone that refuses just forgets. */
export function saveCart(storage: Pick<Storage, "setItem" | "removeItem"> | undefined, cart: Cart) {
  try {
    if (cart.length === 0) storage?.removeItem(CART_STORAGE_KEY);
    else storage?.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // Storage full or blocked; the order still works for this visit.
  }
}

// ---------------------------------------------------------------- the order

export type OrderDetails = {
  mode: OrderMode;
  /** Table number as typed or picked; only for table orders. */
  table: string;
  name: string;
  /** A number to call back on; asked for everything but table orders (see needsPhone). */
  phone: string;
  address: string;
  when: string;
  note: string;
  /** A PaymentMethod, or "" when the shop does not ask how they will pay. */
  payment: string;
  /** Shared from the phone for a delivery; null when only an address was typed. */
  location: GeoPoint | null;
};

export type GeoPoint = { lat: number; lng: number };

export function isGeoPoint(value: unknown): value is GeoPoint {
  if (typeof value !== "object" || value === null) return false;
  const { lat, lng } = value as Record<string, unknown>;
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/** Google Maps at a point: opens directions on a phone. */
export function mapsLink(point: GeoPoint): string {
  return `https://www.google.com/maps?q=${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
}

/** What stops this order being sent, in words for the customer, or null when it is ready. */
export function orderProblem(
  config: OrderingConfig,
  cart: Cart,
  details: OrderDetails,
): string | null {
  if (cart.length === 0) return "Add something to your order first.";

  const total = cartTotal(cart);
  if (total < config.minOrder) {
    return `The minimum order is ${formatPrice(config.minOrder)}. Add ${formatPrice(
      config.minOrder - total,
    )} more.`;
  }

  if (!config.modes.includes(details.mode)) return "Choose how you'd like your order.";

  if (details.mode === "table") {
    const table = Number(details.table);
    if (!Number.isInteger(table) || table < 1 || table > config.tables) return "Choose your table number.";
  } else {
    if (!details.name.trim()) return "Enter your name so we know whose order it is.";
    if (needsPhone(details.mode) && !isPhoneNumber(details.phone)) {
      return "Enter a 10-digit phone number so we can call you about the order.";
    }
  }

  // Every way of ordering, tables included, says how it will be paid for.
  if (config.payments.length > 0 && !(config.payments as string[]).includes(details.payment)) {
    return "Choose how you'll pay.";
  }
  if (details.mode === "delivery" && !details.address.trim()) {
    return "Enter the address to deliver to.";
  }
  if (details.mode === "delivery" && !details.location) {
    return "Share your location so we can find you — tap “Share my location”.";
  }
  return null;
}

/** Short, unambiguous order reference — no 0/O or 1/I to misread over the counter. */
export function newOrderId(random: () => number = Math.random): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => alphabet[Math.floor(random() * alphabet.length)]).join("");
}

function headline(details: OrderDetails): string {
  const name = details.name.trim();
  switch (details.mode) {
    case "table":
      return `TABLE ${Number(details.table)}`;
    case "counter":
      return `COUNTER — ${name}`;
    case "pickup":
      return `PICKUP — ${name}`;
    case "delivery":
      return `DELIVERY — ${name}`;
  }
}

/** The message the shop receives on WhatsApp. */
export function orderMessage(order: {
  shopName: string;
  orderId: string;
  cart: Cart;
  details: OrderDetails;
}): string {
  const { shopName, orderId, cart, details } = order;

  const items = cart.map(
    (line) =>
      `• ${line.qty} × ${line.name}${line.size ? ` (${line.size})` : ""} — ${formatPrice(
        line.price * line.qty,
      )}`,
  );

  const extra: string[] = [];
  if (details.mode === "table" && details.name.trim()) extra.push(`Name: ${details.name.trim()}`);
  if (needsPhone(details.mode)) extra.push(`Phone: ${details.phone.trim()}`);
  if (needsTime(details.mode)) extra.push(`When: ${details.when}`);
  if (details.mode === "delivery") extra.push(`Address: ${details.address.trim()}`);
  if (details.mode === "delivery" && details.location) extra.push(`Location: ${mapsLink(details.location)}`);
  if (isPaymentMethod(details.payment)) extra.push(`Payment: ${paymentLabel(details.payment, details.mode)}`);
  if (details.note.trim()) extra.push(`Note: ${details.note.trim()}`);

  return [
    `Hello ${shopName}! New order #${orderId} — ${headline(details)}`,
    "",
    ...items,
    "",
    `Total: ${formatPrice(cartTotal(cart))}`,
    ...extra,
  ].join("\n");
}

/** The link that opens WhatsApp on the shop's chat with the order typed in. */
export function orderLink(whatsapp: string, message: string): string {
  // orderingConfig only hands out numbers WhatsApp accepts, so this is never null.
  return whatsappHref(whatsapp, message) as string;
}

/**
 * A UPI deep link: opens GPay, PhonePe or Paytm with the shop's UPI ID and the
 * amount filled in. Money goes straight to the shop's account — no gateway, no
 * fees — and the owner checks it arrived before marking the order paid.
 */
export function upiLink(payment: { upiId: string; payee: string; amount: number; code: string }): string {
  const params = new URLSearchParams({
    pa: payment.upiId,
    pn: payment.payee,
    am: payment.amount.toFixed(2),
    cu: "INR",
    tn: `Order ${payment.code}`,
  });
  return `upi://pay?${params.toString()}`;
}
