// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * One item in a category listing. The sold-out button is the thing the owner
 * touches most — several times a day, from behind the counter — so it flips on
 * a single press, while deleting asks first.
 */

const { actions } = vi.hoisted(() => ({
  actions: { deleteItem: vi.fn(), moveItem: vi.fn(), toggleItemAvailable: vi.fn() },
}));
vi.mock("@/app/admin/actions", () => actions);
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { default: ItemRow } = await import("./ItemRow");

// Typed rather than inferred: an item with no photo is a real case, and an
// inferred `string` here would reject it.
const item: {
  id: string;
  name: string;
  imageUrl: string | null;
  isAvailable: boolean;
  isVeg: boolean;
  isEggless: boolean;
  isBestseller: boolean;
  priceText: string;
} = {
  id: "i1",
  name: "Choco Truffle Cake",
  imageUrl: "https://res.cloudinary.com/c/image/upload/v1/bakery/cake.jpg",
  isAvailable: true,
  isVeg: true,
  isEggless: false,
  isBestseller: false,
  priceText: "₹350 – ₹650",
};

function renderRow(
  overrides: Partial<typeof item> = {},
  props: { isFirst?: boolean; isLast?: boolean } = {},
) {
  return render(
    <ItemRow
      item={{ ...item, ...overrides }}
      isFirst={props.isFirst ?? false}
      isLast={props.isLast ?? false}
    />,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("what the row shows", () => {
  it("names the item and its price", () => {
    renderRow();

    expect(screen.getByText("Choco Truffle Cake")).toBeInTheDocument();
    expect(screen.getByText("₹350 – ₹650")).toBeInTheDocument();
  });

  it("links to the item's own page", () => {
    renderRow();
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/admin/items/i1");
  });

  it("shows the photo when there is one", () => {
    const { container } = renderRow();
    expect(container.querySelector("img")).toHaveAttribute("src", item.imageUrl);
  });

  it("shows a placeholder when there is not", () => {
    const { container } = renderRow({ imageUrl: null });
    expect(container.querySelector("img")).toBeNull();
  });

  it("greys a sold-out item's photo", () => {
    const { container } = renderRow({ isAvailable: false });
    expect(container.querySelector("img")).toHaveClass("grayscale");
  });

  it("leaves an available item's photo in colour", () => {
    const { container } = renderRow();
    expect(container.querySelector("img")).not.toHaveClass("grayscale");
  });
});

describe("the marks beside the name", () => {
  it("stars a bestseller", () => {
    renderRow({ isBestseller: true });
    expect(screen.getByText("★")).toBeInTheDocument();
  });

  it("leaves an ordinary item unstarred", () => {
    renderRow();
    expect(screen.queryByText("★")).not.toBeInTheDocument();
  });

  it("notes an eggless item", () => {
    renderRow({ isEggless: true });
    expect(screen.getByText(/· Eggless/)).toBeInTheDocument();
  });

  it("notes a non-veg one", () => {
    renderRow({ isVeg: false });
    expect(screen.getByText(/· Non-veg/)).toBeInTheDocument();
  });

  it("notes both together", () => {
    renderRow({ isVeg: false, isEggless: true });
    expect(screen.getByText("₹350 – ₹650 · Eggless · Non-veg")).toBeInTheDocument();
  });

  it("says nothing extra about a plain veg item", () => {
    renderRow();
    expect(screen.getByText("₹350 – ₹650")).toBeInTheDocument();
  });
});

describe("the sold-out switch", () => {
  // Pressed several times a day from behind the counter: one press, no dialog.
  it("flips an available item in a single press", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByRole("button", { name: "Available" }));

    await waitFor(() => expect(actions.toggleItemAvailable).toHaveBeenCalled());
    expect((actions.toggleItemAvailable.mock.calls[0][0] as FormData).get("id")).toBe("i1");
  });

  it("shows the state it is in, and says it can be flipped", () => {
    renderRow({ isAvailable: false });

    const button = screen.getByRole("button", { name: "Sold out" });
    expect(button).toHaveAttribute("title", "Click to flip");
  });
});

describe("reordering", () => {
  it("sends the direction asked for", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByRole("button", { name: "Move up" }));

    await waitFor(() => expect(actions.moveItem).toHaveBeenCalled());
    const sent = actions.moveItem.mock.calls[0][0] as FormData;
    expect(sent.get("direction")).toBe("up");
    expect(sent.get("id")).toBe("i1");
  });

  it("cannot move the first one up", () => {
    renderRow({}, { isFirst: true });
    expect(screen.getByRole("button", { name: "Move up" })).toBeDisabled();
  });

  it("cannot move the last one down", () => {
    renderRow({}, { isLast: true });
    expect(screen.getByRole("button", { name: "Move down" })).toBeDisabled();
  });
});

describe("deleting", () => {
  // Deleting takes the photo with it and cannot be undone, so it asks.
  it("asks before deleting", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(actions.deleteItem).not.toHaveBeenCalled();
  });

  it("deletes once confirmed", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(actions.deleteItem).toHaveBeenCalled());
    expect((actions.deleteItem.mock.calls[0][0] as FormData).get("id")).toBe("i1");
  });

  it("backs out on No", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "No" }));

    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(actions.deleteItem).not.toHaveBeenCalled();
  });
});
