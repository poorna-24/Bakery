import { describe, expect, it } from "vitest";
import type { MenuCategory, MenuItem } from "./types";
import {
  CART_STORAGE_KEY,
  DEFAULT_ORDERING,
  MAX_QTY,
  ORDERING_KEYS,
  addToCart,
  browserStorage,
  cartCount,
  cartTotal,
  changeQty,
  isGeoPoint,
  isPaymentMethod,
  isUpiId,
  isWhatsappNumber,
  mapsLink,
  paymentLabel,
  upiLink,
  lineKey,
  loadCart,
  newOrderId,
  orderLink,
  orderMessage,
  orderProblem,
  orderingClosed,
  orderingConfig,
  qtyOf,
  reconcileCart,
  saveCart,
  toOrderingSettings,
  type Cart,
  type OrderDetails,
  type OrderingConfig,
  type PaymentMethod,
} from "./ordering";

const SHOP_NUMBER = "+91 76660 93143";

const config: OrderingConfig = {
  modes: ["table", "counter", "pickup", "delivery"],
  tables: 8,
  whatsapp: SHOP_NUMBER,
  minOrder: 0,
  onlyWhenOpen: true,
  payments: [],
  upiId: "",
  upiQr: "",
};

const details: OrderDetails = {
  mode: "table",
  table: "3",
  name: "",
  phone: "",
  address: "",
  when: "As soon as possible",
  note: "",
  payment: "",
  location: null,
};

const pastry = { itemId: "bf", name: "Black Forest Pastry", size: null, price: 80 };
const cake1kg = { itemId: "ct", name: "Choco Truffle Cake", size: "1 kg", price: 650 };

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

describe("toOrderingSettings", () => {
  it("is off, with table and counter orders ready, when nothing is saved", () => {
    expect(toOrderingSettings([])).toEqual(DEFAULT_ORDERING);
    expect(DEFAULT_ORDERING.enabled).toBe(false);
  });

  it("reads every saved setting", () => {
    const rows = [
      [ORDERING_KEYS.enabled, "1"],
      [ORDERING_KEYS.table, "0"],
      [ORDERING_KEYS.counter, "1"],
      [ORDERING_KEYS.pickup, "1"],
      [ORDERING_KEYS.delivery, "0"],
      [ORDERING_KEYS.tables, "12"],
      [ORDERING_KEYS.whatsapp, " 9876543210 "],
      [ORDERING_KEYS.minOrder, "200"],
      [ORDERING_KEYS.onlyWhenOpen, "0"],
      [ORDERING_KEYS.payments, "upi, cash"],
      [ORDERING_KEYS.upiId, " shivam@okaxis "],
      [ORDERING_KEYS.upiQr, " /uploads/qr.png "],
    ].map(([key, value]) => ({ key, value }));

    expect(toOrderingSettings(rows)).toEqual({
      enabled: true,
      modes: { table: false, counter: true, pickup: true, delivery: false },
      tables: 12,
      whatsapp: "9876543210",
      minOrder: 200,
      onlyWhenOpen: false,
      // Fixed order, whatever order they were saved in.
      payments: ["cash", "upi"],
      upiId: "shivam@okaxis",
      upiQr: "/uploads/qr.png",
    });
  });

  it.each(["-1", "2.5", "lots", "999999999"])("ignores a garbled number (%s)", (value) => {
    const settings = toOrderingSettings([
      { key: ORDERING_KEYS.tables, value },
      { key: ORDERING_KEYS.minOrder, value },
    ]);
    expect(settings.tables).toBe(DEFAULT_ORDERING.tables);
    expect(settings.minOrder).toBe(DEFAULT_ORDERING.minOrder);
  });
});

describe("isWhatsappNumber", () => {
  it.each(["+91 76660 93143", "9876543210", "+919876543210"])("accepts %s", (number) => {
    expect(isWhatsappNumber(number)).toBe(true);
  });

  it.each(["", "12345", "phone"])("refuses %j", (number) => {
    expect(isWhatsappNumber(number)).toBe(false);
  });
});

describe("orderingConfig", () => {
  const on = { ...DEFAULT_ORDERING, enabled: true };

  it("is null while ordering is switched off", () => {
    expect(orderingConfig(DEFAULT_ORDERING, SHOP_NUMBER)).toBeNull();
  });

  it("lists the switched-on ways to order, in a fixed order", () => {
    const result = orderingConfig(
      { ...on, modes: { table: true, counter: false, pickup: false, delivery: true } },
      SHOP_NUMBER,
    );
    expect(result?.modes).toEqual(["table", "delivery"]);
  });

  it("sends to the number set on the dashboard over the shop's own", () => {
    expect(orderingConfig({ ...on, whatsapp: "9876543210" }, SHOP_NUMBER)?.whatsapp).toBe(
      "9876543210",
    );
  });

  it("falls back to the shop's number when none is set on the dashboard", () => {
    expect(orderingConfig(on, SHOP_NUMBER)?.whatsapp).toBe(SHOP_NUMBER);
  });

  it("is null when there is no number to send orders to", () => {
    expect(orderingConfig(on, "")).toBeNull();
  });

  it("is null when every way to order is off", () => {
    const none = { table: false, counter: false, pickup: false, delivery: false };
    expect(orderingConfig({ ...on, modes: none }, SHOP_NUMBER)).toBeNull();
  });

  it("drops table orders when there are no tables", () => {
    const tablesOnly = { table: true, counter: false, pickup: false, delivery: false };
    expect(orderingConfig({ ...on, modes: tablesOnly, tables: 0 }, SHOP_NUMBER)).toBeNull();
  });
});

describe("orderingClosed", () => {
  const closed = { isOpen: false, label: "Closed", detail: "Opens 7:00 am" };
  const open = { isOpen: true, label: "Open now", detail: "" };

  it("refuses orders while the shop is closed", () => {
    expect(orderingClosed(config, closed)).toBe(true);
  });

  it("takes orders while open, and when hours were never set", () => {
    expect(orderingClosed(config, open)).toBe(false);
    expect(orderingClosed(config, null)).toBe(false);
  });

  it("takes orders at any time when the owner allows it", () => {
    expect(orderingClosed({ ...config, onlyWhenOpen: false }, closed)).toBe(false);
  });
});

describe("the cart", () => {
  it("adds a new line, then counts more of the same", () => {
    let cart = addToCart([], pastry);
    cart = addToCart(cart, pastry);
    expect(cart).toEqual([{ ...pastry, key: "bf", qty: 2 }]);
  });

  it("keeps two sizes of one cake apart", () => {
    const cart = addToCart(addToCart([], cake1kg), { ...cake1kg, size: "500 g", price: 350 });
    expect(cart.map((line) => line.key)).toEqual(["ct::1 kg", "ct::500 g"]);
    expect(lineKey("ct", null)).toBe("ct");

    // Changing one size leaves the other alone.
    const fewer = changeQty(cart, "ct::500 g", -1);
    expect(fewer).toEqual([cart[0]]);
  });

  it("removes a line that drops to zero", () => {
    const cart = addToCart([], pastry);
    expect(changeQty(cart, "bf", -1)).toEqual([]);
  });

  it("stops at a sensible quantity", () => {
    const cart = changeQty(addToCart([], pastry), "bf", 500);
    expect(cart[0].qty).toBe(MAX_QTY);
  });

  it("totals items and money", () => {
    const cart = addToCart(addToCart(addToCart([], pastry), pastry), cake1kg);
    expect(cartCount(cart)).toBe(3);
    expect(cartTotal(cart)).toBe(810);
    expect(qtyOf(cart, "bf", null)).toBe(2);
    expect(qtyOf(cart, "ct", "500 g")).toBe(0);
  });
});

describe("reconcileCart", () => {
  const categories: MenuCategory[] = [
    {
      id: "c",
      name: "Cakes",
      slug: "cakes",
      description: "",
      items: [
        item({ id: "bf", name: "Black Forest Pastry", price: 90 }),
        item({
          id: "ct",
          name: "Choco Truffle Cake",
          variants: [{ id: "v", label: "1 kg", price: 700 }],
        }),
        item({ id: "gone", isAvailable: false }),
      ],
    },
  ];

  it("updates names and prices to today's menu", () => {
    const cart: Cart = [
      { ...pastry, key: "bf", qty: 2 },
      { ...cake1kg, key: "ct::1 kg", qty: 1 },
    ];
    expect(reconcileCart(cart, categories).map((line) => line.price)).toEqual([90, 700]);
  });

  it("drops what can no longer be ordered", () => {
    const cart: Cart = [
      { ...pastry, itemId: "deleted", key: "deleted", qty: 1 },
      { ...pastry, itemId: "gone", key: "gone", qty: 1 },
      { ...cake1kg, size: "2 kg", key: "ct::2 kg", qty: 1 },
      // Sold as one size when remembered, now sold in sizes.
      { ...cake1kg, size: null, key: "ct", qty: 1 },
    ];
    expect(reconcileCart(cart, categories)).toEqual([]);
  });
});

describe("remembering the cart on the phone", () => {
  function memory(initial?: string) {
    const store = new Map<string, string>(initial ? [[CART_STORAGE_KEY, initial]] : []);
    return {
      store,
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    };
  }

  it("saves and loads the cart", () => {
    const storage = memory();
    const cart = addToCart([], cake1kg);
    saveCart(storage, cart);
    expect(loadCart(storage)).toEqual(cart);
  });

  it("forgets an emptied cart", () => {
    const storage = memory(JSON.stringify(addToCart([], pastry)));
    saveCart(storage, []);
    expect(storage.store.has(CART_STORAGE_KEY)).toBe(false);
  });

  it("starts empty with no storage, nothing saved, or something unreadable", () => {
    expect(loadCart(undefined)).toEqual([]);
    expect(loadCart(memory())).toEqual([]);
    expect(loadCart(memory("{not json"))).toEqual([]);
    expect(loadCart(memory(JSON.stringify({ not: "a list" })))).toEqual([]);
  });

  it("keeps only well-formed lines", () => {
    const good = { ...pastry, key: "bf", qty: 1 };
    const saved = [good, null, { ...good, qty: 0 }, { ...good, price: "80" }, { ...good, size: 5 }];
    expect(loadCart(memory(JSON.stringify(saved)))).toEqual([good]);
  });

  // These tests run outside a browser, where there is no window at all.
  it("finds no storage where there is no browser", () => {
    expect(browserStorage()).toBeUndefined();
  });

  it("shrugs off storage that refuses", () => {
    const refusing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadCart(refusing)).toEqual([]);
    expect(() => saveCart(refusing, addToCart([], pastry))).not.toThrow();
    expect(() => saveCart(undefined, [])).not.toThrow();
  });
});

describe("orderProblem", () => {
  const cart = addToCart([], pastry);

  it("is happy with a complete table order", () => {
    expect(orderProblem(config, cart, details)).toBeNull();
  });

  it("needs something in the cart", () => {
    expect(orderProblem(config, [], details)).toMatch(/add something/i);
  });

  it("holds back an order under the minimum, saying how much more", () => {
    expect(orderProblem({ ...config, minOrder: 200 }, cart, details)).toBe(
      "The minimum order is ₹200. Add ₹120 more.",
    );
  });

  it("refuses a way of ordering the shop has switched off", () => {
    expect(orderProblem({ ...config, modes: ["table"] }, cart, { ...details, mode: "counter" })).toMatch(
      /choose how/i,
    );
  });

  it.each(["", "0", "9", "2.5", "two"])("wants a real table number (%j)", (table) => {
    expect(orderProblem(config, cart, { ...details, table })).toMatch(/table number/i);
  });

  it.each(["counter", "pickup", "delivery"] as const)("needs a name for %s orders", (mode) => {
    expect(orderProblem(config, cart, { ...details, mode, name: "  " })).toMatch(/your name/i);
  });

  it.each(["counter", "pickup", "delivery"] as const)(
    "needs a phone number to call back for %s orders",
    (mode) => {
      for (const phone of ["", "98765", "phone"]) {
        expect(orderProblem(config, cart, { ...details, mode, name: "Ravi", phone })).toMatch(
          /10-digit phone number/,
        );
      }
    },
  );

  it("accepts a counter order with a name and a phone number", () => {
    expect(
      orderProblem(config, cart, { ...details, mode: "counter", name: "Ravi", phone: "98765 43210" }),
    ).toBeNull();
  });

  // Seated at a table, the customer is easy to find: no number is asked for.
  it("does not ask a table order for a phone number", () => {
    expect(orderProblem(config, cart, { ...details, phone: "" })).toBeNull();
  });

  it("needs an address for delivery", () => {
    const withPhone = { ...details, mode: "delivery" as const, name: "Ravi", phone: "+91 98765 43210" };
    expect(orderProblem(config, cart, withPhone)).toMatch(/address/i);
    expect(orderProblem(config, cart, { ...withPhone, address: "12 MG Road" })).toMatch(/share your location/i);
    expect(
      orderProblem(config, cart, { ...withPhone, address: "12 MG Road", location: { lat: 17.38, lng: 78.48 } }),
    ).toBeNull();
  });

  it("accepts a pickup with a name and a phone number", () => {
    expect(
      orderProblem(config, cart, { ...details, mode: "pickup", name: "Ravi", phone: "98765-43210" }),
    ).toBeNull();
  });
});

describe("newOrderId", () => {
  it("makes a four-character code without look-alike characters", () => {
    expect(newOrderId()).toMatch(/^[A-HJKMNP-Z2-9]{4}$/);
    expect(newOrderId(() => 0)).toBe("AAAA");
    expect(newOrderId(() => 0.999)).toBe("9999");
  });
});

describe("orderMessage", () => {
  const cart = addToCart(addToCart(addToCart([], pastry), pastry), cake1kg);

  it("leads with the table for a table order", () => {
    expect(
      orderMessage({ shopName: "Shivam Bakery", orderId: "B7K2", cart, details: { ...details, note: " Less sugar " } }),
    ).toBe(
      [
        "Hello Shivam Bakery! New order #B7K2 — TABLE 3",
        "",
        "• 2 × Black Forest Pastry — ₹160",
        "• 1 × Choco Truffle Cake (1 kg) — ₹650",
        "",
        "Total: ₹810",
        "Note: Less sugar",
      ].join("\n"),
    );
  });

  it("adds the name to a table order when given", () => {
    const text = orderMessage({ shopName: "S", orderId: "A", cart, details: { ...details, name: "Anu" } });
    expect(text).toContain("Name: Anu");
  });

  it("names the customer at the counter", () => {
    const text = orderMessage({
      shopName: "S",
      orderId: "A",
      cart,
      details: { ...details, mode: "counter", name: " Ravi ", phone: "98765 43210" },
    });
    expect(text.split("\n")[0]).toBe("Hello S! New order #A — COUNTER — Ravi");
    expect(text).toContain("Phone: 98765 43210");
    // An order for now: no time asked for.
    expect(text).not.toContain("When:");
  });

  it("leaves the phone out of a table order", () => {
    const text = orderMessage({ shopName: "S", orderId: "A", cart, details });
    expect(text).not.toContain("Phone:");
  });

  it("says when for a pickup, and when and where for a delivery", () => {
    const pickup = orderMessage({
      shopName: "S",
      orderId: "A",
      cart,
      details: { ...details, mode: "pickup", name: "Ravi", phone: " 98765 43210 ", when: "In 1 hour" },
    });
    expect(pickup).toContain("PICKUP — Ravi");
    expect(pickup).toContain("Phone: 98765 43210\nWhen: In 1 hour");
    expect(pickup).not.toContain("Address:");

    const delivery = orderMessage({
      shopName: "S",
      orderId: "A",
      cart,
      details: {
        ...details,
        mode: "delivery",
        name: "Ravi",
        phone: "+91 98765 43210",
        when: "Tomorrow",
        address: " 12 MG Road ",
      },
    });
    expect(delivery).toContain("DELIVERY — Ravi");
    expect(delivery).toContain("Phone: +91 98765 43210");
    expect(delivery).toContain("When: Tomorrow");
    expect(delivery).toContain("Address: 12 MG Road");
  });
});

describe("orderLink", () => {
  it("opens the shop's chat with the order typed in", () => {
    expect(orderLink(SHOP_NUMBER, "Hi & bye")).toBe("https://wa.me/917666093143?text=Hi%20%26%20bye");
  });
});

describe("paying", () => {
  it("reads every payment method by default, and none when the owner unticks them all", () => {
    expect(toOrderingSettings([]).payments).toEqual(["cash", "upi", "card"]);
    expect(toOrderingSettings([{ key: ORDERING_KEYS.payments, value: "" }]).payments).toEqual([]);
  });

  it("ignores a UPI ID that isn't one", () => {
    expect(toOrderingSettings([{ key: ORDERING_KEYS.upiId, value: "not an id" }]).upiId).toBe("");
  });

  it.each(["shivambakery@okaxis", "98765.43210@ybl", "shop-name_1@paytm"])("accepts the UPI ID %s", (id) => {
    expect(isUpiId(id)).toBe(true);
  });

  it.each(["", "shivam", "@okaxis", "a@b", "shivam@ok axis"])("refuses %j as a UPI ID", (id) => {
    expect(isUpiId(id)).toBe(false);
  });

  it("names each way to pay, cash differently for deliveries", () => {
    expect(isPaymentMethod("upi")).toBe(true);
    expect(isPaymentMethod("cheque")).toBe(false);
    expect(paymentLabel("cash")).toBe("Cash");
    expect(paymentLabel("cash", "delivery")).toBe("Cash on delivery");
    expect(paymentLabel("upi")).toBe("UPI (GPay / PhonePe / Paytm)");
    expect(paymentLabel("card", "table")).toBe("Card");
  });

  it("asks how they'll pay when the shop offers a choice", () => {
    const paying = { ...config, payments: ["cash", "upi"] as PaymentMethod[] };
    const cart = addToCart([], pastry);
    expect(orderProblem(paying, cart, details)).toBe("Choose how you'll pay.");
    expect(orderProblem(paying, cart, { ...details, payment: "card" })).toBe("Choose how you'll pay.");
    expect(orderProblem(paying, cart, { ...details, payment: "upi" })).toBeNull();
  });

  it("builds a UPI link with the amount and order filled in", () => {
    expect(upiLink({ upiId: "shivam@okaxis", payee: "Shivam Bakery", amount: 810, code: "B7K2" })).toBe(
      "upi://pay?pa=shivam%40okaxis&pn=Shivam+Bakery&am=810.00&cu=INR&tn=Order+B7K2",
    );
  });

  it("puts the payment and the delivery location in the message", () => {
    const text = orderMessage({
      shopName: "S",
      orderId: "A",
      cart: addToCart([], pastry),
      details: {
        ...details,
        mode: "delivery",
        name: "Ravi",
        phone: "98765 43210",
        address: "12 MG Road",
        payment: "cash",
        location: { lat: 17.385044, lng: 78.486671 },
      },
    });
    expect(text).toContain("Location: https://www.google.com/maps?q=17.385044,78.486671");
    expect(text).toContain("Payment: Cash on delivery");
  });

  it("leaves payment out of the message when none was chosen", () => {
    const text = orderMessage({ shopName: "S", orderId: "A", cart: addToCart([], pastry), details });
    expect(text).not.toContain("Payment:");
  });
});

describe("locations", () => {
  it.each([
    [{ lat: 17.38, lng: 78.48 }, true],
    [{ lat: -90, lng: 180 }, true],
    [{ lat: 91, lng: 0 }, false],
    [{ lat: 0, lng: -181 }, false],
    [{ lat: "17", lng: 78 }, false],
    [null, false],
    ["17,78", false],
  ])("reads %j as a location: %s", (value, ok) => {
    expect(isGeoPoint(value)).toBe(ok);
  });

  it("links a point to Google Maps", () => {
    expect(mapsLink({ lat: 17.385, lng: 78.4867 })).toBe("https://www.google.com/maps?q=17.385000,78.486700");
  });
});
