import { describe, expect, it } from "vitest";
import { formatPrice, priceLabel, slugify, variantRange, type MenuItem } from "./types";

function item(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: "i1",
    name: "Choco Truffle Cake",
    description: "",
    price: 650,
    unit: "per kg",
    imageUrl: null,
    isVeg: true,
    isEggless: false,
    isBestseller: false,
    isAvailable: true,
    variants: [],
    ...overrides,
  };
}

describe("slugify", () => {
  it("lowercases and hyphenates a plain name", () => {
    expect(slugify("Chocolate Delights")).toBe("chocolate-delights");
  });

  it("spells out & so two categories cannot collide on punctuation alone", () => {
    expect(slugify("Breads, Dry Cakes & Biscuits")).toBe("breads-dry-cakes-and-biscuits");
  });

  it("drops leading and trailing punctuation rather than leaving stray hyphens", () => {
    expect(slugify("  ...Cakes!!  ")).toBe("cakes");
  });

  it("collapses runs of whitespace into one hyphen", () => {
    expect(slugify("Hot   Fresh   Bites")).toBe("hot-fresh-bites");
  });

  it("expands each & separately, so &&& is not silently one word", () => {
    // Not pretty, but predictable — and no real category name looks like this.
    expect(slugify("Hot &&& Fresh")).toBe("hot-and-and-and-fresh");
  });

  it("returns an empty string when nothing survives, so callers can fall back", () => {
    expect(slugify("!!!")).toBe("");
  });

  it("caps the length so a pasted paragraph cannot become the slug", () => {
    expect(slugify("a".repeat(200)).length).toBeLessThanOrEqual(60);
  });

  it("keeps digits, which sizes and years rely on", () => {
    expect(slugify("2 Kg Cakes")).toBe("2-kg-cakes");
  });
});

describe("formatPrice", () => {
  it("shows whole rupees without decimals", () => {
    expect(formatPrice(650)).toBe("₹650");
  });

  it("shows paise only when there are any", () => {
    expect(formatPrice(649.5)).toBe("₹649.50");
  });

  it("groups thousands the Indian way", () => {
    // 1,25,000 — not 125,000.
    expect(formatPrice(125000)).toBe("₹1,25,000");
  });

  it("handles zero", () => {
    expect(formatPrice(0)).toBe("₹0");
  });

  it("does not show 649.999 as ₹650.00 with phantom paise", () => {
    expect(formatPrice(649.999)).toBe("₹650");
  });
});

describe("variantRange", () => {
  it("is null with no variants, so the caller uses the base price", () => {
    expect(variantRange([])).toBeNull();
  });

  it("shows one price when a single size exists", () => {
    expect(variantRange([{ price: 450 }])).toBe("₹450");
  });

  it("collapses to one price when every size costs the same", () => {
    expect(variantRange([{ price: 450 }, { price: 450 }])).toBe("₹450");
  });

  it("shows low to high across sizes", () => {
    expect(variantRange([{ price: 850 }, { price: 450 }])).toBe("₹450 – ₹850");
  });

  it("finds the extremes regardless of the order they were added in", () => {
    expect(variantRange([{ price: 600 }, { price: 300 }, { price: 900 }])).toBe("₹300 – ₹900");
  });
});

describe("priceLabel", () => {
  it("shows the base price and its unit when there are no sizes", () => {
    expect(priceLabel(item())).toBe("₹650 per kg");
  });

  it("shows the range and drops the unit once sizes carry it", () => {
    expect(
      priceLabel(
        item({
          variants: [
            { id: "v1", label: "500 g", price: 350 },
            { id: "v2", label: "1 kg", price: 650 },
          ],
        }),
      ),
    ).toBe("₹350 – ₹650");
  });

  it("prefers the sizes over the base price when both are set", () => {
    // The owner may leave a stale base price behind after adding sizes.
    expect(priceLabel(item({ price: 9999, variants: [{ id: "v1", label: "1 kg", price: 650 }] })))
      .toBe("₹650");
  });
});
