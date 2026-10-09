// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Cart, OrderingConfig } from "@/lib/ordering";
import type { ShopHours } from "@/lib/hours";

// The real server action is never called here; each test hands in `submit`.
vi.mock("@/app/order-actions", () => ({ submitOrder: vi.fn() }));
const { default: OrderSheet } = await import("./OrderSheet");

const config: OrderingConfig = {
  modes: ["table", "counter", "pickup", "delivery"],
  tables: 8,
  whatsapp: "+91 76660 93143",
  minOrder: 0,
  onlyWhenOpen: true,
  payments: [],
  upiId: "",
  upiQr: "",
};

const cart: Cart = [
  { key: "ct::1 kg", itemId: "ct", name: "Choco Truffle Cake", size: "1 kg", price: 650, qty: 1 },
  { key: "bf", itemId: "bf", name: "Black Forest Pastry", size: null, price: 80, qty: 2 },
];

// Same open and close time means round the clock; every day off means always shut.
const alwaysOpen: ShopHours = { open: "00:00", close: "00:00", closedDays: [] };
const alwaysClosed: ShopHours = { open: "07:00", close: "21:00", closedDays: [0, 1, 2, 3, 4, 5, 6] };

let opened: string[];

beforeEach(() => {
  opened = [];
  vi.spyOn(window, "open").mockImplementation((url) => {
    opened.push(String(url));
    return null;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** The server saved it and priced it the same. */
const saved = (code = "B7K2") => vi.fn().mockResolvedValue({ ok: true, code, cart, total: 810 });

function renderSheet(props: Partial<React.ComponentProps<typeof OrderSheet>> = {}) {
  const handlers = {
    onChange: vi.fn(),
    onClose: vi.fn(),
    onDone: vi.fn(),
    onAddMore: vi.fn(),
    submit: (props.submit ?? saved()) as ReturnType<typeof vi.fn>,
  };
  const result = render(
    <OrderSheet config={config} cart={cart} shopName="Shivam Bakery" hours={alwaysOpen} {...props} {...handlers} />,
  );
  return { ...result, ...handlers };
}

async function send(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /send order on whatsapp/i }));
}

function sentMessage(): string {
  return decodeURIComponent(opened[0].split("text=")[1]);
}

function fakeLocation(outcome: "found" | "denied") {
  const getCurrentPosition = vi.fn((ok: PositionCallback, fail: PositionErrorCallback) => {
    if (outcome === "found") ok({ coords: { latitude: 17.385, longitude: 78.4867 } } as GeolocationPosition);
    else fail({ code: 1 } as GeolocationPositionError);
  });
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition } });
  return getCurrentPosition;
}

afterEach(() => {
  // jsdom has no geolocation of its own; take away any fake one.
  Reflect.deleteProperty(navigator, "geolocation");
});

describe("reviewing the order", () => {
  it("lists every line with its size, price and the total", () => {
    renderSheet();

    expect(screen.getByRole("dialog", { name: "Your order" })).toBeInTheDocument();
    expect(screen.getByText("1 kg · ₹650 each")).toBeInTheDocument();
    expect(screen.getByText("₹80 each")).toBeInTheDocument();
    expect(screen.getByText("₹160")).toBeInTheDocument();
    expect(screen.getByText("₹810")).toBeInTheDocument();
  });

  it("changes quantities from the review", async () => {
    const user = userEvent.setup();
    const { onChange } = renderSheet();

    await user.click(screen.getByRole("button", { name: "Add one more Black Forest Pastry" }));
    await user.click(screen.getByRole("button", { name: "Remove one Choco Truffle Cake (1 kg)" }));
    expect(onChange.mock.calls).toEqual([
      ["bf", 1],
      ["ct::1 kg", -1],
    ]);
  });

  it("goes back to add more, keeping the order", async () => {
    const user = userEvent.setup();
    const { onAddMore, onChange } = renderSheet();

    await user.click(screen.getByRole("button", { name: "+ Add more items" }));
    expect(onAddMore).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("flags an order under the minimum before it is sent", () => {
    renderSheet({ config: { ...config, minOrder: 1000 } });
    expect(screen.getByText("The minimum order is ₹1,000. Add ₹190 more.")).toBeInTheDocument();
  });

  it("has nothing to send once everything is removed", async () => {
    const user = userEvent.setup();
    const { onClose } = renderSheet({ cart: [] });

    expect(screen.getByText("Your order is empty")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to the menu" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("where the customer is", () => {
  it("asks for a table number for a table order, with the name optional and no phone", async () => {
    const user = userEvent.setup();
    const { submit } = renderSheet();

    expect(screen.getByRole("button", { name: /i'm at a table/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Your name (optional)")).toBeInTheDocument();
    expect(screen.queryByLabelText("Phone number")).not.toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(9); // "Choose your table" + 8 tables

    await send(user);
    expect(screen.getByRole("alert")).toHaveTextContent("Choose your table number.");
    expect(submit).not.toHaveBeenCalled();

    // Editing clears the complaint.
    await user.selectOptions(screen.getByLabelText("Table number"), "3");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("saves a table order, then opens WhatsApp with the shop's order number", async () => {
    const user = userEvent.setup();
    const { submit } = renderSheet({ submit: saved("Q9ZX") });

    await user.selectOptions(screen.getByLabelText("Table number"), "3");
    await user.type(screen.getByLabelText("Your name (optional)"), "Anu");
    await user.type(screen.getByLabelText("Note (optional)"), "Less sugar");
    await send(user);

    expect(submit).toHaveBeenCalledWith({
      lines: [
        { itemId: "ct", size: "1 kg", qty: 1 },
        { itemId: "bf", size: null, qty: 2 },
      ],
      details: expect.objectContaining({ mode: "table", table: "3", name: "Anu", note: "Less sugar" }),
    });
    await waitFor(() => expect(opened).toHaveLength(1));
    expect(opened[0]).toMatch(/^https:\/\/wa\.me\/917666093143\?text=/);
    const message = sentMessage();
    expect(message).toMatch(/^\*New order #Q9ZX\* — Table 3\nAnu\n/);
    expect(message).toContain("1 × Choco Truffle Cake (1 kg) — ₹650");
    expect(message).toContain("*Total ₹810*");
    expect(message).toContain("_Note: Less sugar_");
    expect(screen.getByRole("heading", { name: "Order #Q9ZX" })).toBeInTheDocument();
  });

  it("needs a name and a phone number at the counter, but no time", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByRole("button", { name: /i'm at the counter/i }));
    expect(screen.queryByLabelText("Table number")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("When")).not.toBeInTheDocument();
    await send(user);
    expect(screen.getByRole("alert")).toHaveTextContent(/your name/i);

    await user.type(screen.getByLabelText("Your name"), "Ravi");
    await send(user);
    expect(screen.getByRole("alert")).toHaveTextContent(/10-digit phone number/);

    await user.type(screen.getByLabelText("Phone number"), "98765 43210");
    await send(user);
    await waitFor(() => expect(opened).toHaveLength(1));
    expect(sentMessage()).toMatch(/— Counter\nRavi · 98765 43210\n/);
  });

  it("asks for a phone number and a time for a pickup", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByRole("button", { name: /pick up later/i }));
    await user.type(screen.getByLabelText("Your name"), "Ravi");
    const phone = screen.getByLabelText("Phone number");
    expect(phone).toHaveAttribute("type", "tel");
    await user.type(phone, "98765 43210");
    await user.selectOptions(screen.getByLabelText("When"), "In 1 hour");
    await send(user);

    await waitFor(() => expect(opened).toHaveLength(1));
    expect(sentMessage()).toContain("Ravi · 98765 43210 · In 1 hour");
  });

  it("skips the question when the shop takes orders only one way", () => {
    renderSheet({ config: { ...config, modes: ["counter"] } });

    expect(screen.queryByText("Where are you?")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
  });
});

describe("delivery", () => {
  async function fillDelivery(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: /delivery/i }));
    await user.type(screen.getByLabelText("Your name"), "Ravi");
    await user.type(screen.getByLabelText("Phone number"), "+91 98765 43210");
    await user.type(screen.getByLabelText("Delivery address"), "12 MG Road");
  }

  it("needs the customer's location, then sends a map link with the order", async () => {
    const user = userEvent.setup();
    const asked = fakeLocation("found");
    renderSheet();
    await fillDelivery(user);

    await send(user);
    expect(screen.getByRole("alert")).toHaveTextContent(/share your location/i);

    await user.click(screen.getByRole("button", { name: /share my location/i }));
    expect(asked).toHaveBeenCalled();
    expect(screen.getByText(/location added/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "check on map" })).toHaveAttribute(
      "href",
      "https://www.google.com/maps?q=17.385000,78.486700",
    );

    await send(user);
    await waitFor(() => expect(opened).toHaveLength(1));
    expect(sentMessage()).toContain("📍 12 MG Road");
    expect(sentMessage()).toContain("\nhttps://www.google.com/maps?q=17.385000,78.486700");
  });

  it("lets the customer take a shared location back", async () => {
    const user = userEvent.setup();
    fakeLocation("found");
    renderSheet();
    await fillDelivery(user);

    await user.click(screen.getByRole("button", { name: /share my location/i }));
    await user.click(screen.getByRole("button", { name: "remove" }));
    expect(screen.getByRole("button", { name: /share my location/i })).toBeInTheDocument();
  });

  it("says so when the location is refused", async () => {
    const user = userEvent.setup();
    fakeLocation("denied");
    renderSheet();
    await fillDelivery(user);

    await user.click(screen.getByRole("button", { name: /share my location/i }));
    expect(screen.getByText(/couldn't get your location/i)).toBeInTheDocument();
  });

  it("says so on a phone that cannot share a location at all", async () => {
    const user = userEvent.setup();
    renderSheet();
    await fillDelivery(user);

    await user.click(screen.getByRole("button", { name: /share my location/i }));
    expect(screen.getByText(/can't share its location/i)).toBeInTheDocument();
  });

  it("shows that it is looking while the phone finds the location", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: vi.fn() }, // never answers
    });
    renderSheet();
    await fillDelivery(user);

    await user.click(screen.getByRole("button", { name: /share my location/i }));
    expect(screen.getByRole("button", { name: /finding you/i })).toBeDisabled();
  });
});

describe("paying", () => {
  const paying = { ...config, payments: ["cash", "upi", "card"] as OrderingConfig["payments"] };

  it("asks how the customer will pay, naming cash differently for delivery", async () => {
    const user = userEvent.setup();
    renderSheet({ config: paying });

    const select = screen.getByLabelText("How will you pay?");
    expect(screen.getByRole("option", { name: "Cash" })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Table number"), "3");
    await send(user);
    expect(screen.getByRole("alert")).toHaveTextContent("Choose how you'll pay.");

    await user.click(screen.getByRole("button", { name: /delivery/i }));
    expect(screen.getByRole("option", { name: "Cash on delivery" })).toBeInTheDocument();
    expect(select).toBeInTheDocument();
  });

  it("chooses for the customer when there is only one way to pay", () => {
    renderSheet({ config: { ...config, payments: ["cash"] } });
    expect(screen.getByLabelText("How will you pay?")).toHaveValue("cash");
    expect(screen.queryByRole("option", { name: /choose a way to pay/i })).not.toBeInTheDocument();
  });

  it("sends a card or cash order straight to WhatsApp", async () => {
    const user = userEvent.setup();
    renderSheet({ config: paying });
    await user.selectOptions(screen.getByLabelText("Table number"), "3");
    await user.selectOptions(screen.getByLabelText("How will you pay?"), "card");
    await send(user);

    await waitFor(() => expect(opened).toHaveLength(1));
    expect(sentMessage()).toContain("*Total ₹810* · Card");
  });

  it("has a UPI payer pay first, then send — with a pay button and the shop's QR", async () => {
    const user = userEvent.setup();
    renderSheet({ config: { ...paying, upiId: "shivam@okaxis", upiQr: "/uploads/qr.png" } });
    await user.selectOptions(screen.getByLabelText("Table number"), "3");
    await user.selectOptions(screen.getByLabelText("How will you pay?"), "upi");
    await send(user);

    expect(await screen.findByText("Step 1 · Pay ₹810 by UPI")).toBeInTheDocument();
    // WhatsApp waits until they have paid.
    expect(opened).toEqual([]);
    expect(screen.getByRole("link", { name: "Pay ₹810 with a UPI app" })).toHaveAttribute(
      "href",
      "upi://pay?pa=shivam%40okaxis&pn=Shivam+Bakery&am=810.00&cu=INR&tn=Order+B7K2",
    );
    expect(screen.getByRole("img", { name: "UPI QR code for Shivam Bakery" })).toHaveAttribute("src", "/uploads/qr.png");
    expect(screen.getByRole("link", { name: /send order on whatsapp/i })).toHaveAttribute(
      "href",
      expect.stringMatching(/^https:\/\/wa\.me\//),
    );
  });

  it("shows just the QR when the shop has no UPI ID", async () => {
    const user = userEvent.setup();
    renderSheet({ config: { ...paying, upiQr: "/uploads/qr.png" } });
    await user.selectOptions(screen.getByLabelText("Table number"), "3");
    await user.selectOptions(screen.getByLabelText("How will you pay?"), "upi");
    await send(user);

    expect(await screen.findByRole("img", { name: /upi qr code/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /with a upi app/i })).not.toBeInTheDocument();
  });

  it("just sends on WhatsApp when the shop has set up nothing to pay by UPI with", async () => {
    const user = userEvent.setup();
    renderSheet({ config: paying });
    await user.selectOptions(screen.getByLabelText("Table number"), "3");
    await user.selectOptions(screen.getByLabelText("How will you pay?"), "upi");
    await send(user);

    await waitFor(() => expect(opened).toHaveLength(1));
    expect(screen.queryByText(/step 1/i)).not.toBeInTheDocument();
  });
});

describe("when saving the order goes wrong", () => {
  async function tryTableOrder(submit: ReturnType<typeof vi.fn>) {
    const user = userEvent.setup();
    renderSheet({ submit });
    await user.selectOptions(screen.getByLabelText("Table number"), "3");
    await send(user);
    return user;
  }

  it("shows what the shop said, and opens nothing", async () => {
    await tryTableOrder(vi.fn().mockResolvedValue({ ok: false, error: "Choco Truffle Cake is sold out right now." }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Choco Truffle Cake is sold out right now.");
    expect(opened).toEqual([]);
  });

  it("offers to send on WhatsApp anyway when the shop can't be reached", async () => {
    const user = await tryTableOrder(vi.fn().mockRejectedValue(new Error("offline")));
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't reach the shop/i);

    await user.click(screen.getByRole("button", { name: /send it on whatsapp anyway/i }));
    expect(opened).toHaveLength(1);
    expect(sentMessage()).toMatch(/^\*New order #[A-Z2-9]{4}\* — Table 3/);
    expect(screen.getByText(/without reaching the shop's list/i)).toBeInTheDocument();
  });

  it("offers WhatsApp anyway when the shop could not save the order", async () => {
    await tryTableOrder(
      vi.fn().mockResolvedValue({ ok: false, fallback: true, error: "We couldn't save your order just now." }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't save your order just now.");
    expect(screen.getByRole("button", { name: /send it on whatsapp anyway/i })).toBeInTheDocument();
  });

  it("does not offer WhatsApp anyway for an order the shop refused", async () => {
    await tryTableOrder(vi.fn().mockResolvedValue({ ok: false, error: "The shop isn't taking orders here right now." }));
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: /send it on whatsapp anyway/i })).not.toBeInTheDocument();
  });

  it("shows that it is working while the order is saved", async () => {
    const user = userEvent.setup();
    renderSheet({ submit: vi.fn(() => new Promise<never>(() => {})) });
    await user.selectOptions(screen.getByLabelText("Table number"), "3");
    await send(user);
    expect(screen.getByRole("button", { name: /placing your order/i })).toBeDisabled();
  });
});

describe("while the shop is closed", () => {
  it("holds the order back and says why", () => {
    renderSheet({ hours: alwaysClosed });

    expect(screen.getByText("We're closed right now")).toBeInTheDocument();
    expect(screen.getByText(/closed today · you can send your order once we're open/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send order on whatsapp/i })).not.toBeInTheDocument();
  });

  it("still takes orders when the owner allows it outside hours", () => {
    renderSheet({ hours: alwaysClosed, config: { ...config, onlyWhenOpen: false } });
    expect(screen.getByRole("button", { name: /send order on whatsapp/i })).toBeInTheDocument();
  });

  it("takes orders when no opening hours are set", () => {
    renderSheet({ hours: null });
    expect(screen.getByRole("button", { name: /send order on whatsapp/i })).toBeInTheDocument();
  });
});

describe("after sending", () => {
  async function sendTableOrder() {
    const user = userEvent.setup();
    const handlers = renderSheet();
    await user.selectOptions(screen.getByLabelText("Table number"), "3");
    await send(user);
    await screen.findByRole("heading", { name: "Order #B7K2" });
    return { user, ...handlers };
  }

  it("gives the order number and a way to reopen WhatsApp", async () => {
    await sendTableOrder();
    expect(screen.getByRole("link", { name: /try again/i })).toHaveAttribute("href", opened[0]);
  });

  it("empties the order when the customer is done", async () => {
    const { user, onDone } = await sendTableOrder();
    await user.click(screen.getByRole("button", { name: /done — start a new order/i }));
    expect(onDone).toHaveBeenCalled();
  });
});

describe("the sheet itself", () => {
  it("closes on Escape and on tapping outside, and frees the page scroll", async () => {
    const user = userEvent.setup();
    const { onClose, unmount } = renderSheet();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.keyDown(window, { key: "Enter" });
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);

    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
