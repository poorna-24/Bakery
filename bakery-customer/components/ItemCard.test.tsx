import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ItemCard from "./ItemCard";
import type { MenuItem } from "@/lib/types";

function item(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: "i1",
    name: "Choco Truffle Cake",
    description: "",
    price: 650,
    unit: "per kg",
    imageUrl: "https://res.cloudinary.com/demo/image/upload/v1/bakery/x.jpg",
    isVeg: true,
    isEggless: false,
    isBestseller: false,
    isAvailable: true,
    variants: [],
    ...overrides,
  };
}

/**
 * The photo fades in on its load event. A cached image finishes loading before
 * React attaches that handler, so the event never arrives and the card is left
 * transparent — an empty tile on the menu, while the same photo renders fine in
 * the detail sheet. These pin the recovery.
 */
describe("the photo becomes visible", () => {
  it("when the image is already cached before React attaches its handler", () => {
    // jsdom reports complete === false by default; a cached image reports true.
    const spy = vi
      .spyOn(HTMLImageElement.prototype, "complete", "get")
      .mockReturnValue(true);

    render(<ItemCard item={item()} onOpen={() => {}} />);
    expect(screen.getByAltText("Choco Truffle Cake")).not.toHaveClass("opacity-0");

    spy.mockRestore();
  });

  it("when the image loads normally afterwards", () => {
    render(<ItemCard item={item()} onOpen={() => {}} />);
    const img = screen.getByAltText("Choco Truffle Cake");

    expect(img).toHaveClass("opacity-0");
    fireEvent.load(img);
    expect(img).not.toHaveClass("opacity-0");
  });

  // A broken URL should not leave a permanently blank tile either.
  it("even when the image fails to load", () => {
    render(<ItemCard item={item()} onOpen={() => {}} />);
    const img = screen.getByAltText("Choco Truffle Cake");

    fireEvent.error(img);
    expect(img).not.toHaveClass("opacity-0");
  });

  it("shows a placeholder when the item has no photo at all", () => {
    render(<ItemCard item={item({ imageUrl: null })} onOpen={() => {}} />);
    expect(screen.queryByAltText("Choco Truffle Cake")).not.toBeInTheDocument();
  });
});

describe("what the card marks on the tile", () => {
  it("badges an eggless item", () => {
    render(<ItemCard item={item({ isEggless: true })} onOpen={() => {}} />);
    expect(screen.getByText("EGGLESS")).toBeInTheDocument();
  });

  it("badges a bestseller", () => {
    render(<ItemCard item={item({ isBestseller: true })} onOpen={() => {}} />);
    expect(screen.getByText("★ BESTSELLER")).toBeInTheDocument();
  });

  it("shows neither badge on an ordinary item", () => {
    render(<ItemCard item={item()} onOpen={() => {}} />);
    expect(screen.queryByText("EGGLESS")).not.toBeInTheDocument();
    expect(screen.queryByText("★ BESTSELLER")).not.toBeInTheDocument();
  });

  // Sold out has to read at a glance: the label alone is easy to miss when
  // the photo still looks appetising, so the picture is greyed as well.
  it("greys the photo and covers it when the item is sold out", () => {
    render(<ItemCard item={item({ isAvailable: false })} onOpen={() => {}} />);

    expect(screen.getByText("Sold out")).toBeInTheDocument();
    expect(screen.getByAltText("Choco Truffle Cake")).toHaveClass("grayscale");
  });

  it("leaves an available item's photo in colour", () => {
    render(<ItemCard item={item()} onOpen={() => {}} />);
    expect(screen.getByAltText("Choco Truffle Cake")).not.toHaveClass("grayscale");
  });
});

describe("tapping the card", () => {
  it("opens the detail sheet", () => {
    const onOpen = vi.fn();
    render(<ItemCard item={item()} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  // Sold-out items stay tappable — people still want the price and the photo.
  it("opens even when the item is sold out", () => {
    const onOpen = vi.fn();
    render(<ItemCard item={item({ isAvailable: false })} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
