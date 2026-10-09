// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { StoredOrder } from "@/lib/orders";

const { actions } = vi.hoisted(() => ({ actions: { setOrderStatus: vi.fn(), setOrderPaid: vi.fn() } }));
vi.mock("@/app/admin/actions", () => actions);

const { default: OrderCard } = await import("./OrderCard");

const TODAY = new Date("2026-10-07T18:30:00Z");

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
    total: 810,
    createdAt: new Date("2026-10-08T05:00:00Z"),
    lines: [
      { itemId: "ct", name: "Choco Truffle Cake", size: "1 kg", price: 650, qty: 1 },
      { itemId: "bf", name: "Black Forest Pastry", size: null, price: 80, qty: 2 },
    ],
    ...overrides,
  };
}

/** The value a hidden field in the form around `button` would send. */
function sends(button: HTMLElement, name: string): string | undefined {
  return (button.closest("form")?.querySelector(`input[name="${name}"]`) as HTMLInputElement | null)?.value;
}

describe("OrderCard", () => {
  it("shows the table, the items, the total and the time", () => {
    render(<OrderCard order={order()} status="new" todayStart={TODAY} />);

    expect(screen.getByText("#B7K2")).toBeInTheDocument();
    expect(screen.getByText("Table 3")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByText("10:30 am")).toBeInTheDocument();
    expect(screen.getByText("1 × Choco Truffle Cake (1 kg)")).toBeInTheDocument();
    expect(screen.getByText("2 × Black Forest Pastry")).toBeInTheDocument();
    expect(screen.getByText("Total ₹810")).toBeInTheDocument();
    // A table order has no phone and nothing to deliver.
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("offers every next step on an open order, with Completed stressed", () => {
    render(<OrderCard order={order({ status: "preparing" })} status="preparing" todayStart={TODAY} />);

    expect(screen.queryByRole("button", { name: "Preparing" })).not.toBeInTheDocument();
    const completed = screen.getByRole("button", { name: "Completed" });
    expect(completed).toHaveClass("btn-primary");
    expect(sends(completed, "status")).toBe("completed");
    expect(sends(completed, "id")).toBe("o1");
    expect(sends(screen.getByRole("button", { name: "Ready" }), "status")).toBe("ready");
    expect(sends(screen.getByRole("button", { name: "Cancel" }), "status")).toBe("cancelled");
  });

  it("can reopen a finished order", () => {
    render(<OrderCard order={order({ status: "cancelled" })} status="cancelled" todayStart={TODAY} />);

    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Completed" })).not.toBeInTheDocument();
    expect(sends(screen.getByRole("button", { name: "Reopen" }), "status")).toBe("new");
  });

  it("marks an order left untouched yesterday as completed automatically", () => {
    render(
      <OrderCard order={order({ createdAt: new Date("2026-10-06T14:15:00Z") })} status="completed" todayStart={TODAY} />,
    );
    expect(screen.getByText("Completed (auto)")).toBeInTheDocument();
    expect(screen.getByText("6 Oct, 7:45 pm")).toBeInTheDocument();
  });

  it("toggles paid and unpaid, naming how the customer will pay", () => {
    const { rerender } = render(<OrderCard order={order({ payment: "upi" })} status="new" todayStart={TODAY} />);
    expect(screen.getByText(/UPI \(GPay/)).toBeInTheDocument();
    expect(sends(screen.getByRole("button", { name: /unpaid — mark paid/i }), "paid")).toBe("1");

    rerender(<OrderCard order={order({ payment: "upi", paid: true })} status="new" todayStart={TODAY} />);
    expect(sends(screen.getByRole("button", { name: /paid ✓/i }), "paid")).toBe("0");
  });

  it("gives a counter order's phone number, with call and WhatsApp links", () => {
    render(
      <OrderCard order={order({ mode: "counter", name: "Ravi", phone: "98765 43210" })} status="new" todayStart={TODAY} />,
    );

    expect(screen.getByText("Counter · Ravi")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "98765 43210" })).toHaveAttribute("href", "tel:9876543210");
    expect(screen.getByRole("link", { name: "WhatsApp them" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^https:\/\/wa\.me\/919876543210\?text=Hi%20Ravi/),
    );
  });

  it("shows a delivery's address, time, note and the way to it", () => {
    render(
      <OrderCard
        order={order({
          mode: "delivery",
          name: "Ravi",
          phone: "98765 43210",
          address: "12 MG Road",
          latitude: 17.385,
          longitude: 78.4867,
          whenText: "In 1 hour",
          note: "Ring twice",
          payment: "cash",
        })}
        status="new"
        todayStart={TODAY}
      />,
    );

    expect(screen.getByText("12 MG Road")).toBeInTheDocument();
    expect(screen.getByText("Wanted: In 1 hour")).toBeInTheDocument();
    expect(screen.getByText("Note: Ring twice")).toBeInTheDocument();
    expect(screen.getByText(/Cash on delivery/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in Maps" })).toHaveAttribute(
      "href",
      "https://www.google.com/maps?q=17.385000,78.486700",
    );
  });

  it("has no map link for a delivery with neither location nor address", () => {
    render(<OrderCard order={order({ mode: "delivery", name: "Ravi" })} status="new" todayStart={TODAY} />);
    expect(screen.queryByRole("link", { name: "Open in Maps" })).not.toBeInTheDocument();
  });
});
