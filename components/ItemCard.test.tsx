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
