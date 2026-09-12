import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ItemSheet from "./ItemSheet";
import type { MenuItem } from "@/lib/types";

/**
 * The detail sheet that opens when a customer taps an item. It is the last
 * thing they see before ringing the shop, so the price, the sold-out state and
 * the two contact buttons all have to be right.
 */

const baseItem: MenuItem = {
  id: "item-1",
  name: "Black Forest Cake",
  description: "Cherries and cream, made fresh each morning.",
  price: 650,
  unit: "per kg",
  imageUrl: "https://res.cloudinary.com/c/image/upload/v1/bakery/cake.jpg",
  isVeg: true,
  isEggless: false,
  isBestseller: true,
  isAvailable: true,
  variants: [],
};

function renderSheet(item: Partial<MenuItem> = {}, props: Partial<{ phone: string; whatsapp: string }> = {}) {
  const onClose = vi.fn();
  const view = render(
    <ItemSheet
      item={{ ...baseItem, ...item }}
      phone={props.phone ?? "+91 76660 93143"}
      whatsapp={props.whatsapp ?? "+91 76660 93143"}
      shopName="SHIVAM BAKERY"
      onClose={onClose}
    />,
  );
  return { ...view, onClose };
}

describe("what the sheet shows", () => {
  it("names the item and describes it", () => {
    renderSheet();

    expect(screen.getByRole("heading", { name: "Black Forest Cake" })).toBeInTheDocument();
    expect(screen.getByText(/cherries and cream/i)).toBeInTheDocument();
  });

  it("is announced as a dialog labelled with the item", () => {
    renderSheet();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Black Forest Cake");
  });

  it("shows the photo when there is one", () => {
    renderSheet();
    expect(screen.getByAltText("Black Forest Cake")).toHaveAttribute(
      "src",
      baseItem.imageUrl,
    );
  });

  it("leaves the picture out entirely when the item has none", () => {
    renderSheet({ imageUrl: null });
    expect(screen.queryByAltText("Black Forest Cake")).not.toBeInTheDocument();
  });

  it("omits the description when the item has none", () => {
    renderSheet({ description: "" });
    expect(screen.queryByText(/cherries and cream/i)).not.toBeInTheDocument();
  });
});

describe("the tags along the top", () => {
  it("marks a veg bestseller", () => {
    renderSheet();

    expect(screen.getByText("Veg")).toBeInTheDocument();
    expect(screen.getByText("★ Bestseller")).toBeInTheDocument();
    expect(screen.queryByText("Eggless")).not.toBeInTheDocument();
  });

  it("marks a non-veg item as such", () => {
    renderSheet({ isVeg: false, isBestseller: false });

    expect(screen.getByText("Non-veg")).toBeInTheDocument();
    expect(screen.queryByText("Veg")).not.toBeInTheDocument();
  });

  it("shows the eggless tag when it applies", () => {
    renderSheet({ isEggless: true });
    expect(screen.getByText("Eggless")).toBeInTheDocument();
  });
});

describe("an item the shop has run out of", () => {
  // The customer must not ring up expecting something that is gone.
  it("says so plainly", () => {
    renderSheet({ isAvailable: false });
    expect(screen.getByText("Sold out today")).toBeInTheDocument();
  });

  it("greys the photo out as well as saying it", () => {
    renderSheet({ isAvailable: false });
    expect(screen.getByAltText("Black Forest Cake").className).toContain("grayscale");
  });

  it("leaves the photo in colour when it is available", () => {
    renderSheet();
    expect(screen.getByAltText("Black Forest Cake").className).not.toContain("grayscale");
  });
});

describe("prices", () => {
  it("shows the single price and its unit when there are no sizes", () => {
    renderSheet();

    expect(screen.getByText("₹650")).toBeInTheDocument();
    expect(screen.getByText("per kg")).toBeInTheDocument();
  });

  // Every size is a separate line, because "from ₹350" is not enough to
  // decide on when you are standing at the counter.
  it("lists every size with its own price", () => {
    renderSheet({
      variants: [
        { id: "v1", label: "500 g", price: 350 },
        { id: "v2", label: "1 kg", price: 650 },
        { id: "v3", label: "2 kg", price: 1250 },
      ],
    });

    expect(screen.getByText("500 g")).toBeInTheDocument();
    expect(screen.getByText("₹350")).toBeInTheDocument();
    expect(screen.getByText("₹1,250")).toBeInTheDocument();
    // The base price and unit give way to the sizes.
    expect(screen.queryByText("per kg")).not.toBeInTheDocument();
  });

  it("shows paise when a price has them", () => {
    renderSheet({ price: 649.5 });
    expect(screen.getByText("₹649.50")).toBeInTheDocument();
  });
});

describe("getting in touch about this item", () => {
  it("opens WhatsApp with the item already named in the message", () => {
    renderSheet();

    const link = screen.getByRole("link", { name: /ask about this on whatsapp/i });
    const href = link.getAttribute("href") ?? "";

    expect(href).toContain("https://wa.me/917666093143");
    expect(decodeURIComponent(href)).toContain("Black Forest Cake");
    expect(decodeURIComponent(href)).toContain("SHIVAM BAKERY");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("falls back to the phone number when no WhatsApp number is set", () => {
    renderSheet({}, { whatsapp: "" });

    expect(
      screen.getByRole("link", { name: /ask about this on whatsapp/i }),
    ).toHaveAttribute("href", expect.stringContaining("wa.me/917666093143"));
  });

  it("offers a call link", () => {
    renderSheet();
    expect(screen.getByRole("link", { name: /call the shop/i })).toHaveAttribute(
      "href",
      "tel:+917666093143",
    );
  });

  // A shop that has not filled in a number should not show a dead button.
  it("hides both buttons when no number is configured at all", () => {
    renderSheet({}, { phone: "", whatsapp: "" });

    expect(screen.queryByRole("link", { name: /whatsapp/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /call the shop/i })).not.toBeInTheDocument();
  });
});

describe("closing the sheet", () => {
  // Two controls close the sheet and both are called "Close": the dimmed area
  // behind it, and the button at the foot. They appear in that order.
  function closeControls() {
    return screen.getAllByRole("button", { name: "Close" });
  }

  it("closes on the Close button at the foot", () => {
    const { onClose } = renderSheet();

    const [, button] = closeControls();
    fireEvent.click(button);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when the dimmed area behind it is tapped", () => {
    const { onClose } = renderSheet();

    const [scrim] = closeControls();
    fireEvent.click(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", () => {
    const { onClose } = renderSheet();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores other keys", () => {
    const { onClose } = renderSheet();

    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.keyDown(window, { key: "a" });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("the page behind the sheet", () => {
  // Without this the menu scrolls under your finger while the sheet is open.
  it("stops scrolling while the sheet is up", () => {
    renderSheet();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("gives scrolling back when the sheet closes", () => {
    const { unmount } = renderSheet();
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("restores whatever the page had set rather than clearing it", () => {
    document.body.style.overflow = "auto";
    const { unmount } = renderSheet();

    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("auto");

    document.body.style.overflow = "";
  });

  it("stops listening for Escape once it is gone", () => {
    const { onClose, unmount } = renderSheet();
    unmount();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
