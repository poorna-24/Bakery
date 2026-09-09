import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Menu from "./Menu";
import type { MenuCategory } from "@/lib/types";
import { DEFAULT_APPEARANCE } from "@/lib/backgrounds";

const categories: MenuCategory[] = [
  {
    id: "c1",
    name: "Cakes",
    slug: "cakes",
    description: "Celebrate life's sweet moments.",
    items: [
      {
        id: "i1",
        name: "Choco Truffle Cake",
        description: "Rich Belgian chocolate.",
        price: 650,
        unit: "per kg",
        imageUrl: null,
        isVeg: true,
        isEggless: false,
        isBestseller: true,
        isAvailable: true,
        variants: [
          { id: "v1", label: "500 g", price: 350 },
          { id: "v2", label: "1 kg", price: 650 },
        ],
      },
      {
        id: "i2",
        name: "Fresh Pineapple Cake",
        description: "",
        price: 550,
        unit: "per kg",
        imageUrl: null,
        isVeg: true,
        isEggless: false,
        isBestseller: false,
        isAvailable: false,
        variants: [],
      },
    ],
  },
  {
    id: "c2",
    name: "Hot & Fresh Bites",
    slug: "hot-and-fresh-bites",
    description: "Out of the oven through the day.",
    items: [
      {
        id: "i3",
        name: "Chicken Puff",
        description: "Masala chicken.",
        price: 40,
        unit: "per piece",
        imageUrl: null,
        isVeg: false,
        isEggless: false,
        isBestseller: false,
        isAvailable: true,
        variants: [],
      },
    ],
  },
];

function renderMenu(overrides: Partial<React.ComponentProps<typeof Menu>> = {}) {
  return render(
    <Menu
      categories={categories}
      shopName="SHIVAM BAKERY"
      tagline="Handcrafted delights."
      address="Cherial, Telangana"
      mapUrl="https://maps.example/shop"
      phone=""
      whatsapp=""
      credit={{ name: "", whatsapp: "" }}
      appearance={DEFAULT_APPEARANCE}
      hours={null}
      hoursStatus={null}
      {...overrides}
    />,
  );
}

describe("the menu", () => {
  it("lists every category and item", () => {
    renderMenu();
    expect(screen.getByRole("heading", { name: "Cakes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hot & Fresh Bites" })).toBeInTheDocument();
    expect(screen.getByText("Choco Truffle Cake")).toBeInTheDocument();
    expect(screen.getByText("Chicken Puff")).toBeInTheDocument();
  });

  it("shows a price range for an item with sizes and a unit price for one without", () => {
    renderMenu();
    expect(screen.getByText("₹350 – ₹650")).toBeInTheDocument();
    expect(screen.getByText("₹40 per piece")).toBeInTheDocument();
  });

  it("keeps a sold-out item on the menu rather than hiding it", () => {
    renderMenu();
    expect(screen.getByText("Fresh Pineapple Cake")).toBeInTheDocument();
    expect(screen.getByText("Sold out")).toBeInTheDocument();
  });

  it("marks a non-veg item differently from a veg one", () => {
    renderMenu();
    expect(screen.getAllByLabelText("Vegetarian").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Non-vegetarian").length).toBe(1);
  });

  it("tells the customer when there is nothing on the menu at all", () => {
    renderMenu({ categories: [] });
    expect(screen.getByText(/being set up/i)).toBeInTheDocument();
  });
});

describe("search", () => {
  it("narrows to matching items and drops categories with no match", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByLabelText("Search the menu"));
    await user.type(screen.getByPlaceholderText(/search/i), "puff");

    expect(screen.getByText("Chicken Puff")).toBeInTheDocument();
    expect(screen.queryByText("Choco Truffle Cake")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Cakes" })).not.toBeInTheDocument();
  });

  it("matches on the description, not just the name", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByLabelText("Search the menu"));
    await user.type(screen.getByPlaceholderText(/search/i), "belgian");

    expect(screen.getByText("Choco Truffle Cake")).toBeInTheDocument();
  });

  it("ignores case", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByLabelText("Search the menu"));
    await user.type(screen.getByPlaceholderText(/search/i), "CHICKEN");

    expect(screen.getByText("Chicken Puff")).toBeInTheDocument();
  });

  it("says so when nothing matches", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByLabelText("Search the menu"));
    await user.type(screen.getByPlaceholderText(/search/i), "sushi");

    expect(screen.getByText(/no matches for/i)).toBeInTheDocument();
  });

  it("restores the full menu when the search is closed", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByLabelText("Search the menu"));
    await user.type(screen.getByPlaceholderText(/search/i), "puff");
    await user.click(screen.getByLabelText("Close search"));

    expect(screen.getByText("Choco Truffle Cake")).toBeInTheDocument();
  });
});

describe("the item sheet", () => {
  it("opens with every size and price when a card is tapped", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByText("Choco Truffle Cake"));

    const sheet = screen.getByRole("dialog", { name: "Choco Truffle Cake" });
    expect(within(sheet).getByText("500 g")).toBeInTheDocument();
    expect(within(sheet).getByText("₹350")).toBeInTheDocument();
    expect(within(sheet).getByText("1 kg")).toBeInTheDocument();
    expect(within(sheet).getByText("₹650")).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByText("Choco Truffle Cake"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("frees the page scroll again after closing", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByText("Choco Truffle Cake"));
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});

describe("the footer", () => {
  it("offers directions when a map link is set", () => {
    renderMenu();
    const link = screen.getByRole("link", { name: /get directions/i });
    expect(link).toHaveAttribute("href", "https://maps.example/shop");
  });

  it("hides the call button until a phone number is set", () => {
    renderMenu();
    expect(screen.queryByRole("link", { name: /call the shop/i })).not.toBeInTheDocument();
  });

  it("shows a call link when a number is set", () => {
    renderMenu({ phone: "+91 76660 93143" });
    expect(screen.getAllByRole("link", { name: /call/i })[0]).toHaveAttribute(
      "href",
      "tel:+917666093143",
    );
  });

  it("offers WhatsApp when a number is set", () => {
    renderMenu({ whatsapp: "+917666093143" });
    expect(screen.getByRole("link", { name: /message on whatsapp/i })).toHaveAttribute(
      "href",
      expect.stringContaining("https://wa.me/917666093143"),
    );
  });

  it("falls back to the phone number for WhatsApp when none is set separately", () => {
    renderMenu({ phone: "+91 76660 93143", whatsapp: "" });
    expect(screen.getByRole("link", { name: /message on whatsapp/i })).toHaveAttribute(
      "href",
      expect.stringContaining("wa.me/917666093143"),
    );
  });

  it("hides both buttons when no number is configured at all", () => {
    renderMenu();
    expect(screen.queryByRole("link", { name: /whatsapp/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /call/i })).not.toBeInTheDocument();
  });
});

describe("the builder credit", () => {
  it("is hidden when no name is configured", () => {
    renderMenu();
    expect(screen.queryByText(/page created by/i)).not.toBeInTheDocument();
  });

  it("names the builder and links to their WhatsApp", () => {
    renderMenu({ credit: { name: "Poorna Chander Terala", whatsapp: "+918099057599" } });

    expect(screen.getByText(/page created by/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Poorna Chander Terala" });
    expect(link.getAttribute("href")).toContain("https://wa.me/918099057599");
  });

  it("shows the name as plain text when no number is given", () => {
    renderMenu({ credit: { name: "Poorna Chander Terala", whatsapp: "" } });

    expect(screen.getByText("Poorna Chander Terala")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Poorna Chander Terala" })).not.toBeInTheDocument();
  });

  it("does not shout over the shop's own contact buttons", () => {
    // The shop's WhatsApp button and the credit link must stay distinguishable.
    renderMenu({
      whatsapp: "+917666093143",
      credit: { name: "Poorna Chander Terala", whatsapp: "+918099057599" },
    });

    const shopLink = screen.getByRole("link", { name: /message on whatsapp/i });
    const creditLink = screen.getByRole("link", { name: "Poorna Chander Terala" });
    expect(shopLink.getAttribute("href")).toContain("917666093143");
    expect(creditLink.getAttribute("href")).toContain("918099057599");
  });
});

describe("asking about one item", () => {
  it("opens WhatsApp with the item already named in the message", async () => {
    const user = userEvent.setup();
    renderMenu({ whatsapp: "+917666093143" });

    await user.click(screen.getByText("Choco Truffle Cake"));

    const sheet = screen.getByRole("dialog");
    const link = within(sheet).getByRole("link", { name: /ask about this on whatsapp/i });
    const url = new URL(link.getAttribute("href")!);

    expect(url.hostname).toBe("wa.me");
    expect(url.searchParams.get("text")).toContain("Choco Truffle Cake");
    expect(url.searchParams.get("text")).toContain("SHIVAM BAKERY");
  });
});
