// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OrderItemRow from "./OrderItemRow";
import CartBar from "./CartBar";
import type { MenuItem } from "@/lib/types";
import type { Cart } from "@/lib/ordering";

function item(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
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
    variants: [
      { id: "v1", label: "500 g", price: 350 },
      { id: "v2", label: "1 kg", price: 650 },
    ],
    ...overrides,
  };
}

function renderRow(props: { item?: MenuItem; cart?: Cart } = {}) {
  const onAdd = vi.fn();
  const onChange = vi.fn();
  render(
    <OrderItemRow item={props.item ?? item()} cart={props.cart ?? []} onAdd={onAdd} onChange={onChange} />,
  );
  return { onAdd, onChange };
}

describe("OrderItemRow", () => {
  it("adds the chosen size at its price", async () => {
    const user = userEvent.setup();
    const { onAdd } = renderRow();

    expect(screen.getByText("₹350")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "1 kg" }));
    expect(screen.getByRole("button", { name: "1 kg" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("₹650")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add Choco Truffle Cake (1 kg)" }));
    expect(onAdd).toHaveBeenCalledWith({ itemId: "ct", name: "Choco Truffle Cake", size: "1 kg", price: 650 });
  });

  it("adds an item sold one way at its own price", async () => {
    const user = userEvent.setup();
    const { onAdd } = renderRow({ item: item({ id: "bf", name: "Black Forest Pastry", price: 80, variants: [] }) });

    await user.click(screen.getByRole("button", { name: "Add Black Forest Pastry" }));
    expect(onAdd).toHaveBeenCalledWith({ itemId: "bf", name: "Black Forest Pastry", size: null, price: 80 });
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("names a single size without offering a choice", () => {
    renderRow({ item: item({ variants: [{ id: "v", label: "Box of 6", price: 240 }] }) });
    expect(screen.getByText("Box of 6")).toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("swaps Add for a counter once it is in the order, per size", async () => {
    const user = userEvent.setup();
    const cart: Cart = [
      { key: "ct::500 g", itemId: "ct", name: "Choco Truffle Cake", size: "500 g", price: 350, qty: 2 },
    ];
    const { onChange } = renderRow({ cart });

    await user.click(screen.getByRole("button", { name: "Add one more Choco Truffle Cake (500 g)" }));
    await user.click(screen.getByRole("button", { name: "Remove one Choco Truffle Cake (500 g)" }));
    expect(onChange.mock.calls).toEqual([
      ["ct::500 g", 1],
      ["ct::500 g", -1],
    ]);

    // The other size is not in the order yet.
    await user.click(screen.getByRole("button", { name: "1 kg" }));
    expect(screen.getByRole("button", { name: "Add Choco Truffle Cake (1 kg)" })).toBeInTheDocument();
  });

  it("shows the photo, and cannot add a sold-out item", () => {
    renderRow({ item: item({ isAvailable: false, imageUrl: "/uploads/cake.jpg", variants: [] }) });

    expect(document.querySelector("img")).toHaveAttribute("src", "/uploads/cake.jpg");
    expect(document.querySelector("img")).toHaveClass("grayscale");
    expect(screen.getByText("Sold out")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add/i })).not.toBeInTheDocument();
  });

  it("shows an available item's photo in colour", () => {
    renderRow({ item: item({ imageUrl: "/uploads/cake.jpg" }) });
    expect(document.querySelector("img")).not.toHaveClass("grayscale");
  });
});

describe("CartBar", () => {
  it("shows the count and total and opens the review", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<CartBar count={3} total={1290} onOpen={onOpen} />);

    expect(screen.getByRole("button")).toHaveTextContent("3 items · ₹1,290");
    await user.click(screen.getByRole("button", { name: /review order/i }));
    expect(onOpen).toHaveBeenCalled();
  });

  it("says item for just one", () => {
    render(<CartBar count={1} total={80} onOpen={() => {}} />);
    expect(screen.getByRole("button")).toHaveTextContent("1 item · ₹80");
  });
});
