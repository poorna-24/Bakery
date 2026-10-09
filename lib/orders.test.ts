import { describe, expect, it } from "vitest";
import type { MenuItem } from "./types";
import {
  MAX_LINES,
  byHour,
  byMode,
  effectiveStatus,
  isOpen,
  isOrderStatus,
  isPeriod,
  orderMapsLink,
  orderTime,
  parseOrderRequest,
  periodStart,
  priceOrder,
  shopHour,
  startOfShopDay,
  summarize,
  topItems,
  whereLabel,
  type StoredOrder,
} from "./orders";

function item(overrides: Partial<MenuItem>): MenuItem {
  return {
    id: "x",
    name: "Item",
    description: "",
    price: 100,
    unit: "per piece",
    imageUrl: null,
    isVeg: true,
    isEggless: false,
    isBestseller: false,
    isAvailable: true,
    variants: [],
    ...overrides,
  };
}

// 10:30 in the morning in India, 8 Oct 2026.
const NOW = new Date("2026-10-08T05:00:00Z");
const TODAY = startOfShopDay(NOW);

function order(overrides: Partial<StoredOrder> = {}): StoredOrder {
  return {
    id: "o1",
    code: "B7K2",
    mode: "table",
    tableNo: 3,
    name: "",
    phone: "",
    address: "",
    latitude: null,
    longitude: null,
    whenText: "",
    note: "",
    payment: "",
    paid: false,
    status: "new",
    total: 160,
    createdAt: NOW,
    lines: [{ itemId: "bf", name: "Black Forest Pastry", size: null, price: 80, qty: 2 }],
    ...overrides,
  };
}

describe("parseOrderRequest", () => {
  const good = {
    lines: [{ itemId: "ct", size: "1 kg", qty: 2 }],
    details: { mode: "table", table: "3", name: " Anu ", phone: "", address: "", when: "", note: "", payment: "cash" },
  };

  it("reads a well-formed order, tidying the text", () => {
    const parsed = parseOrderRequest(good);
    expect(parsed).toEqual({
      lines: [{ itemId: "ct", size: "1 kg", qty: 2 }],
      details: {
        mode: "table",
        table: "3",
        name: "Anu",
        phone: "",
        address: "",
        when: "As soon as possible",
        note: "",
        payment: "cash",
        location: null,
      },
    });
  });

  it("keeps a valid shared location and a known time choice", () => {
    const parsed = parseOrderRequest({
      ...good,
      details: { ...good.details, mode: "delivery", when: "In 1 hour", location: { lat: 17.38, lng: 78.48 } },
    });
    expect(parsed).toMatchObject({ details: { when: "In 1 hour", location: { lat: 17.38, lng: 78.48 } } });
  });

  it("drops a nonsense location and caps over-long text", () => {
    const parsed = parseOrderRequest({
      ...good,
      details: { ...good.details, location: { lat: 400, lng: 0 }, note: "x".repeat(500), name: 7 },
    });
    expect(parsed).toMatchObject({ details: { location: null, name: "" } });
    expect("details" in parsed && parsed.details.note).toHaveLength(300);
  });

  it.each([
    ["nothing", null],
    ["a string", "order"],
    ["no lines", { ...good, lines: [] }],
    ["lines that are not a list", { ...good, lines: "ct" }],
    ["a line that is not an object", { ...good, lines: [5] }],
    ["a line with no item", { ...good, lines: [{ itemId: "", size: null, qty: 1 }] }],
    ["a size that is a number", { ...good, lines: [{ itemId: "ct", size: 1, qty: 1 }] }],
    ["zero of something", { ...good, lines: [{ itemId: "ct", size: null, qty: 0 }] }],
    ["half of something", { ...good, lines: [{ itemId: "ct", size: null, qty: 1.5 }] }],
    ["a hundred of something", { ...good, lines: [{ itemId: "ct", size: null, qty: 100 }] }],
    ["no details", { ...good, details: null }],
    ["an unknown way to order", { ...good, details: { ...good.details, mode: "drone" } }],
    ["a way to order that is not text", { ...good, details: { ...good.details, mode: 1 } }],
  ])("refuses %s", (_, body) => {
    expect(parseOrderRequest(body)).toHaveProperty("error");
  });

  it("refuses an order with too many lines", () => {
    const lines = Array.from({ length: MAX_LINES + 1 }, (_, i) => ({ itemId: `i${i}`, size: null, qty: 1 }));
    expect(parseOrderRequest({ ...good, lines })).toEqual({ error: "That order has too many lines." });
  });
});

describe("priceOrder", () => {
  const menu = [
    item({ id: "bf", name: "Black Forest Pastry", price: 80 }),
    item({ id: "ct", name: "Choco Truffle Cake", variants: [{ id: "v", label: "1 kg", price: 650 }] }),
    item({ id: "gone", name: "Pineapple Cake", isAvailable: false }),
  ];

  it("prices from the menu, never from the phone, merging repeated lines", () => {
    const cart = priceOrder(
      [
        { itemId: "bf", size: null, qty: 2 },
        { itemId: "ct", size: "1 kg", qty: 1 },
        { itemId: "bf", size: null, qty: 1 },
      ],
      menu,
    );
    expect(cart).toEqual([
      { key: "bf", itemId: "bf", name: "Black Forest Pastry", size: null, price: 80, qty: 3 },
      { key: "ct::1 kg", itemId: "ct", name: "Choco Truffle Cake", size: "1 kg", price: 650, qty: 1 },
    ]);
  });

  it("caps a merged line at the most anyone can order", () => {
    const cart = priceOrder(
      [
        { itemId: "bf", size: null, qty: 60 },
        { itemId: "bf", size: null, qty: 60 },
      ],
      menu,
    );
    expect(cart).toMatchObject([{ qty: 99 }]);
  });

  it.each([
    ["an item no longer on the menu", { itemId: "deleted", size: null, qty: 1 }, /no longer on the menu/],
    ["a sold-out item", { itemId: "gone", size: null, qty: 1 }, /Pineapple Cake is sold out/],
    ["a size the item doesn't come in", { itemId: "ct", size: "2 kg", qty: 1 }, /Choose a size/],
    ["a size on an item sold one way", { itemId: "bf", size: "1 kg", qty: 1 }, /no longer on the menu/],
  ])("refuses %s", (_, line, message) => {
    expect(priceOrder([line], menu)).toEqual({ error: expect.stringMatching(message) });
  });
});

describe("statuses", () => {
  it("knows which statuses exist and which are still open", () => {
    expect(isOrderStatus("ready")).toBe(true);
    expect(isOrderStatus("lost")).toBe(false);
    expect(["new", "preparing", "ready"].every((s) => isOpen(s as never))).toBe(true);
    expect(isOpen("completed")).toBe(false);
    expect(isOpen("cancelled")).toBe(false);
  });

  it("completes yesterday's untouched orders on its own", () => {
    const yesterday = new Date(TODAY.getTime() - 60 * 60 * 1000);
    expect(effectiveStatus(order({ createdAt: yesterday }), TODAY)).toBe("completed");
    expect(effectiveStatus(order({ createdAt: yesterday, status: "cancelled" }), TODAY)).toBe("cancelled");
  });

  it("leaves today's orders as they are, reading anything odd as new", () => {
    expect(effectiveStatus(order({ status: "preparing" }), TODAY)).toBe("preparing");
    expect(effectiveStatus(order({ status: "mystery" }), TODAY)).toBe("new");
  });
});

describe("whereLabel and orderMapsLink", () => {
  it("says where the customer is", () => {
    expect(whereLabel(order())).toBe("Table 3");
    expect(whereLabel(order({ mode: "counter", name: "Ravi" }))).toBe("Counter · Ravi");
    expect(whereLabel(order({ mode: "pickup", name: "Ravi" }))).toBe("Pickup · Ravi");
    expect(whereLabel(order({ mode: "delivery", name: "Ravi" }))).toBe("Delivery · Ravi");
  });

  it("points the map at the shared location, else searches the address", () => {
    expect(orderMapsLink(order({ latitude: 17.385, longitude: 78.4867 }))).toBe(
      "https://www.google.com/maps?q=17.385000,78.486700",
    );
    expect(orderMapsLink(order({ address: "12 MG Road" }))).toBe(
      "https://www.google.com/maps/search/?api=1&query=12%20MG%20Road",
    );
    expect(orderMapsLink(order())).toBeNull();
  });
});

describe("periods and shop time", () => {
  it("starts the shop's day at midnight India time", () => {
    expect(TODAY.toISOString()).toBe("2026-10-07T18:30:00.000Z");
  });

  it("counts back whole days for the longer periods", () => {
    expect(periodStart("today", NOW)).toEqual(TODAY);
    expect(periodStart("7d", NOW).toISOString()).toBe("2026-10-01T18:30:00.000Z");
    expect(periodStart("30d", NOW).toISOString()).toBe("2026-09-08T18:30:00.000Z");
    expect(isPeriod("7d")).toBe(true);
    expect(isPeriod("year")).toBe(false);
  });

  it("reads the hour at the shop", () => {
    expect(shopHour(NOW)).toBe(10);
  });

  it("shows the time, with the date once it is not today", () => {
    expect(orderTime(NOW, TODAY)).toBe("10:30 am");
    expect(orderTime(new Date("2026-10-06T14:15:00Z"), TODAY)).toBe("6 Oct, 7:45 pm");
  });
});

describe("the analysis", () => {
  const orders = [
    order({ id: "a", total: 160, paid: true }),
    order({
      id: "b",
      mode: "counter",
      total: 650,
      status: "completed",
      createdAt: new Date("2026-10-08T07:40:00Z"),
      lines: [{ itemId: "ct", name: "Choco Truffle Cake", size: "1 kg", price: 650, qty: 1 }],
    }),
    order({
      id: "c",
      mode: "delivery",
      total: 330,
      status: "cancelled",
      lines: [{ itemId: "x", name: "Cancelled Cake", size: null, price: 330, qty: 9 }],
    }),
    order({
      id: "d",
      total: 350,
      createdAt: new Date("2026-10-08T07:50:00Z"),
      lines: [
        { itemId: "ct", name: "Choco Truffle Cake", size: "500 g", price: 350, qty: 1 },
        { itemId: "bf", name: "Black Forest Pastry", size: null, price: 80, qty: 1 },
      ],
    }),
  ];

  it("totals sales, leaving cancelled orders out", () => {
    expect(summarize(orders, TODAY)).toEqual({
      orders: 3,
      sales: 1160,
      average: 1160 / 3,
      waiting: 2,
      unpaid: 1000,
    });
  });

  it("is all zeros with no orders", () => {
    expect(summarize([], TODAY)).toEqual({ orders: 0, sales: 0, average: 0, waiting: 0, unpaid: 0 });
  });

  it("ranks items by quantity, sizes together", () => {
    expect(topItems(orders, TODAY)).toEqual([
      { name: "Black Forest Pastry", qty: 3 },
      { name: "Choco Truffle Cake", qty: 2 },
    ]);
    expect(topItems(orders, TODAY, 1)).toHaveLength(1);
  });

  it("breaks a tie alphabetically", () => {
    const tied = [
      order({ lines: [{ itemId: "z", name: "Zebra Cake", size: null, price: 1, qty: 2 }] }),
      order({ lines: [{ itemId: "a", name: "Apple Pie", size: null, price: 1, qty: 2 }] }),
    ];
    expect(topItems(tied, TODAY).map((entry) => entry.name)).toEqual(["Apple Pie", "Zebra Cake"]);
  });

  it("counts orders by way of ordering, skipping ways nobody used", () => {
    expect(byMode(orders, TODAY)).toEqual([
      { mode: "table", count: 2 },
      { mode: "counter", count: 1 },
    ]);
  });

  it("counts orders by hour at the shop", () => {
    const hours = byHour(orders, TODAY);
    expect(hours).toHaveLength(24);
    expect(hours[10]).toBe(1);
    expect(hours[13]).toBe(2);
    expect(hours.reduce((a, b) => a + b, 0)).toBe(3);
  });
});
