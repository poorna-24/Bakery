import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Saving an order sent from the menu. The database is replaced; what matters
 * is what gets refused, and that the saved order is priced by the server.
 */

const { prisma } = vi.hoisted(() => ({
  prisma: {
    setting: { findMany: vi.fn() },
    item: { findMany: vi.fn() },
    order: { findUnique: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("./db", () => ({ prisma }));

const { placeOrder } = await import("./placeOrder");

let ipCounter = 0;
/** Each test is its own visitor, so the rate limit never leaks between them. */
const client = () => ({ ip: `10.0.0.${++ipCounter}` });

const settings = (extra: Record<string, string> = {}) =>
  Object.entries({
    "ordering.enabled": "1",
    "ordering.table": "1",
    "ordering.counter": "1",
    "ordering.delivery": "1",
    "ordering.tables": "8",
    "ordering.onlyWhenOpen": "1",
    "ordering.payments": "cash,upi",
    ...extra,
  }).map(([key, value]) => ({ key, value }));

const cake = {
  id: "ct",
  name: "Choco Truffle Cake",
  description: "",
  price: 650,
  unit: "per kg",
  imageUrl: null,
  isVeg: true,
  isEggless: false,
  isBestseller: false,
  isAvailable: true,
  variants: [{ id: "v", label: "1 kg", price: 650 }],
};

const tableOrder = {
  lines: [{ itemId: "ct", size: "1 kg", qty: 2 }],
  details: { mode: "table", table: "3", name: "", phone: "", address: "", when: "", note: "Candles", payment: "cash" },
};

const originalWhatsapp = process.env.SHOP_WHATSAPP;

beforeEach(() => {
  process.env.SHOP_WHATSAPP = "+91 76660 93143";
  prisma.setting.findMany.mockResolvedValue(settings());
  prisma.item.findMany.mockResolvedValue([cake]);
  prisma.order.findUnique.mockResolvedValue(null);
  prisma.order.create.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
  if (originalWhatsapp === undefined) delete process.env.SHOP_WHATSAPP;
  else process.env.SHOP_WHATSAPP = originalWhatsapp;
});

describe("placeOrder", () => {
  it("saves a table order priced from the menu", async () => {
    const result = await placeOrder(tableOrder, client());

    expect(result).toMatchObject({ ok: true, total: 1300, cart: [{ name: "Choco Truffle Cake", qty: 2, price: 650 }] });
    const saved = prisma.order.create.mock.calls[0][0].data;
    expect(saved).toMatchObject({
      mode: "table",
      tableNo: 3,
      phone: "",
      address: "",
      latitude: null,
      whenText: "",
      note: "Candles",
      payment: "cash",
      total: 1300,
      lines: { create: [{ itemId: "ct", name: "Choco Truffle Cake", size: "1 kg", price: 650, qty: 2 }] },
    });
    expect(saved.code).toMatch(/^[A-Z2-9]{4}$/);
  });

  it("only asks for items on visible categories", async () => {
    await placeOrder(tableOrder, client());
    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["ct"] }, category: { isVisible: true } } }),
    );
  });

  it("keeps a delivery's address, location and time", async () => {
    const result = await placeOrder(
      {
        lines: tableOrder.lines,
        details: {
          mode: "delivery",
          name: "Ravi",
          phone: "98765 43210",
          address: "12 MG Road",
          when: "In 1 hour",
          note: "",
          payment: "upi",
          location: { lat: 17.38, lng: 78.48 },
        },
      },
      client(),
    );

    expect(result.ok).toBe(true);
    expect(prisma.order.create.mock.calls[0][0].data).toMatchObject({
      mode: "delivery",
      tableNo: null,
      name: "Ravi",
      phone: "98765 43210",
      address: "12 MG Road",
      latitude: 17.38,
      longitude: 78.48,
      whenText: "In 1 hour",
      payment: "upi",
    });
  });

  it("saves no payment when the shop doesn't ask", async () => {
    prisma.setting.findMany.mockResolvedValue(settings({ "ordering.payments": "" }));
    await placeOrder({ ...tableOrder, details: { ...tableOrder.details, payment: "" } }, client());
    expect(prisma.order.create.mock.calls[0][0].data.payment).toBe("");
  });

  it("refuses a malformed order before touching the database", async () => {
    expect(await placeOrder({ lines: [] }, client())).toEqual({ ok: false, error: "Add something to your order first." });
    expect(prisma.setting.findMany).not.toHaveBeenCalled();
  });

  it("refuses orders while ordering is switched off", async () => {
    prisma.setting.findMany.mockResolvedValue(settings({ "ordering.enabled": "0" }));
    expect(await placeOrder(tableOrder, client())).toEqual({
      ok: false,
      error: "The shop isn't taking orders here right now.",
    });
  });

  it("falls back to the shop's phone for WhatsApp, and refuses with neither", async () => {
    delete process.env.SHOP_WHATSAPP;
    process.env.SHOP_PHONE = "+91 76660 93143";
    expect((await placeOrder(tableOrder, client())).ok).toBe(true);
    delete process.env.SHOP_PHONE;
    expect((await placeOrder(tableOrder, client())).ok).toBe(false);
  });

  it("refuses orders while the shop is closed, if the owner says so", async () => {
    const shut = { "hours.open": "07:00", "hours.close": "21:00", "hours.closedDays": "0,1,2,3,4,5,6" };
    prisma.setting.findMany.mockResolvedValue(settings(shut));
    expect(await placeOrder(tableOrder, client())).toMatchObject({ ok: false, error: expect.stringMatching(/closed/) });

    prisma.setting.findMany.mockResolvedValue(settings({ ...shut, "ordering.onlyWhenOpen": "0" }));
    expect((await placeOrder(tableOrder, client())).ok).toBe(true);
  });

  it("refuses a sold-out item", async () => {
    prisma.item.findMany.mockResolvedValue([{ ...cake, isAvailable: false }]);
    expect(await placeOrder(tableOrder, client())).toEqual({
      ok: false,
      error: "Choco Truffle Cake is sold out right now.",
    });
  });

  it("refuses an order missing what the shop needs", async () => {
    const result = await placeOrder(
      { ...tableOrder, details: { ...tableOrder.details, payment: "" } },
      client(),
    );
    expect(result).toEqual({ ok: false, error: "Choose how you'll pay." });
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it("tries a fresh code when one is already taken", async () => {
    prisma.order.findUnique.mockResolvedValueOnce({ id: "taken" }).mockResolvedValueOnce(null);
    expect((await placeOrder(tableOrder, client())).ok).toBe(true);
    expect(prisma.order.findUnique).toHaveBeenCalledTimes(2);
  });

  it("gives up politely if every code it tries is taken", async () => {
    prisma.order.findUnique.mockResolvedValue({ id: "taken" });
    expect(await placeOrder(tableOrder, client())).toEqual({
      ok: false,
      error: "Couldn't save your order. Please try again.",
    });
  });

  it("slows down one address sending order after order", async () => {
    const same = { ip: "10.9.9.9" };
    for (let i = 0; i < 20; i++) await placeOrder({ lines: [] }, same);
    expect(await placeOrder(tableOrder, same)).toEqual({
      ok: false,
      error: "Too many orders from here just now. Please wait a few minutes.",
    });
  });
});

describe("placeOrder when the database fails", () => {
  it("logs the cause and lets the customer send on WhatsApp instead", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    prisma.order.create.mockRejectedValue(new Error('relation "Order" does not exist'));

    expect(await placeOrder(tableOrder, client())).toEqual({
      ok: false,
      fallback: true,
      error: "We couldn't save your order just now. You can still send it to us on WhatsApp.",
    });
    expect(logged).toHaveBeenCalledWith("Saving an order failed:", expect.any(Error));
    logged.mockRestore();
  });
});
