import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Menu from "./Menu";
import type { MenuCategory } from "@/lib/types";
import { DEFAULT_APPEARANCE } from "@/lib/backgrounds";
import type { Offer } from "@/lib/offer";
import type { ShopHours, ShopStatus } from "@/lib/hours";

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
      offer={null}
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

describe("the offer strip", () => {
  const offer: Offer = {
    text: "Diwali special — 20% off all sweets",
    note: "Till 5 November",
    tone: "gold",
    isVisible: true,
  };

  it("is absent when the owner has not set one", () => {
    renderMenu();
    expect(screen.queryByRole("complementary", { name: /offer/i })).not.toBeInTheDocument();
  });

  it("shows the offer text and note", () => {
    renderMenu({ offer });
    const strip = screen.getByRole("complementary", { name: /offer/i });
    expect(within(strip).getByText(offer.text)).toBeInTheDocument();
    expect(within(strip).getByText("Till 5 November")).toBeInTheDocument();
  });

  it("paints it in the colour the owner chose", () => {
    renderMenu({ offer });
    expect(screen.getByRole("complementary", { name: /offer/i })).toHaveClass("offer-gold");
  });

  it("omits the second line when there is none", () => {
    renderMenu({ offer: { ...offer, note: "" } });
    const strip = screen.getByRole("complementary", { name: /offer/i });
    expect(within(strip).queryByText("Till 5 November")).not.toBeInTheDocument();
  });

  // It has to be the first thing read after the scan, above the shop name.
  it("sits above the shop name", () => {
    renderMenu({ offer });
    const strip = screen.getByRole("complementary", { name: /offer/i });
    const heading = screen.getByRole("heading", { name: "SHIVAM BAKERY" });
    expect(strip.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

describe("the open / closed badge", () => {
  const hours: ShopHours = { open: "07:00", close: "21:00", closedDays: [] };
  const status: ShopStatus = { isOpen: true, label: "Open now", detail: "7:00 am – 9:00 pm" };

  it("appears once the owner has set opening times", () => {
    renderMenu({ hours, hoursStatus: status });

    expect(screen.getByText("Open now")).toBeInTheDocument();
    expect(screen.getByText("7:00 am – 9:00 pm")).toBeInTheDocument();
  });

  it("is left out entirely when no times are configured", () => {
    renderMenu();
    expect(screen.queryByText("Open now")).not.toBeInTheDocument();
  });

  // Half-configured hours are no better than none — the badge would have
  // nothing to say — so it stays hidden rather than rendering blank.
  it("stays hidden when the times are set but the status is missing", () => {
    renderMenu({ hours, hoursStatus: null });
    expect(screen.queryByText("Open now")).not.toBeInTheDocument();
  });
});

/**
 * The chip rail and the scroll-spy that drives it. jsdom has no layout engine:
 * every box measures zero and nothing scrolls, so the geometry these read has
 * to be supplied by hand. Without it the centring never runs at all.
 */
describe("the category chips", () => {
  function rect(part: Partial<DOMRect>): DOMRect {
    return {
      top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0,
      toJSON: () => ({}), ...part,
    } as DOMRect;
  }

  /** Puts each section's top edge where the test wants it, in order. */
  function placeSections(...tops: number[]) {
    document.querySelectorAll<HTMLElement>("section[data-slug]").forEach((node, index) => {
      node.getBoundingClientRect = () => rect({ top: tops[index] ?? 0 });
    });
  }

  /** A page long enough that the viewport is not already at the bottom. */
  function makePageLong() {
    Object.defineProperty(document.documentElement, "scrollHeight", {
      value: 5000,
      configurable: true,
    });
  }

  function chip(name: string) {
    return screen.getByRole("button", { name });
  }

  /** Lets the rAF-throttled scroll handler run and settle. */
  async function scrollPage() {
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
  }

  beforeEach(() => {
    // jsdom does not implement this; the component only ever calls it.
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(document.documentElement, "scrollHeight");
  });

  it("lists one chip per category", () => {
    renderMenu();

    expect(chip("Cakes")).toBeInTheDocument();
    expect(chip("Hot & Fresh Bites")).toBeInTheDocument();
  });

  it("scrolls to the section and marks the chip as current when tapped", () => {
    renderMenu();

    fireEvent.click(chip("Hot & Fresh Bites"));

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
    expect(chip("Hot & Fresh Bites")).toHaveAttribute("aria-current", "true");
    expect(chip("Cakes")).not.toHaveAttribute("aria-current");
  });

  it("hides the rail while searching, since there is only one list of results", () => {
    renderMenu();
    expect(chip("Cakes")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Search the menu"));
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: "puff" } });

    expect(screen.queryByRole("button", { name: "Cakes" })).not.toBeInTheDocument();
  });

  it("has no rail at all when the menu is empty", () => {
    renderMenu({ categories: [] });
    expect(screen.queryByRole("button", { name: "Cakes" })).not.toBeInTheDocument();
  });

  describe("following the page as it scrolls", () => {
    it("highlights whichever section is under the header", async () => {
      renderMenu();
      makePageLong();
      // Cakes is under the header; the bites section is still well below it.
      placeSections(0, 500);

      await scrollPage();

      expect(chip("Cakes")).toHaveAttribute("aria-current", "true");
    });

    it("moves the highlight on once the next section reaches the header", async () => {
      renderMenu();
      makePageLong();
      placeSections(-600, 100);

      await scrollPage();

      expect(chip("Hot & Fresh Bites")).toHaveAttribute("aria-current", "true");
    });

    // Otherwise the chips flicker through every category the page flies past
    // on the way to the one that was actually tapped.
    it("ignores readings taken while a tapped jump is still in flight", async () => {
      renderMenu();
      makePageLong();

      fireEvent.click(chip("Hot & Fresh Bites"));
      placeSections(0, 500); // mid-flight, Cakes is still the one on screen

      await scrollPage();

      expect(chip("Hot & Fresh Bites")).toHaveAttribute("aria-current", "true");
    });

    // The last section is often too short to ever reach the header line, so
    // reaching the foot of the page is what says you are looking at it.
    it("highlights the last section once the page bottoms out", async () => {
      renderMenu();
      placeSections(0, 500); // both above the line, but the page is at its end

      await scrollPage();

      expect(chip("Hot & Fresh Bites")).toHaveAttribute("aria-current", "true");
    });

    // The jump lock cannot be held forever: a short last section may never
    // reach the header line, so the landing is never confirmed and the chips
    // would stay frozen on the tapped one.
    it("lets the chips follow the page again once the jump has had time to land", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        renderMenu();
        makePageLong();

        fireEvent.click(chip("Cakes"));
        act(() => {
          vi.advanceTimersByTime(1000);
        });

        placeSections(-600, 100);
        await act(async () => {
          window.dispatchEvent(new Event("scroll"));
          await vi.advanceTimersByTimeAsync(50);
        });

        expect(chip("Hot & Fresh Bites")).toHaveAttribute("aria-current", "true");
      } finally {
        vi.useRealTimers();
      }
    });

    it("stops measuring once the menu leaves the screen", async () => {
      const { unmount } = renderMenu();
      makePageLong();

      // Unmount with a frame still pending; nothing should run afterwards.
      act(() => {
        window.dispatchEvent(new Event("scroll"));
      });
      unmount();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 40));
      });
    });
  });

  describe("keeping the active chip in view on the rail", () => {
    /**
     * @param chipBox where the Cakes chip sits relative to the rail box,
     *   which these tests run from 0 to 320.
     *
     * The scroll-spy makes the last chip active on mount, so Cakes is the one
     * a tap actually moves the rail to.
     */
    function stubRail(chipBox: { left: number; right: number; offsetLeft: number }) {
      const rail = document.querySelector<HTMLElement>("[data-chip]")!.parentElement!;

      Object.defineProperty(rail, "clientWidth", { value: 320, configurable: true });
      Object.defineProperty(rail, "scrollWidth", { value: 900, configurable: true });
      rail.getBoundingClientRect = () => rect({ left: 0, right: 320 });
      rail.scrollTo = vi.fn();

      const target = rail.querySelector<HTMLElement>('[data-chip="cakes"]')!;
      Object.defineProperty(target, "offsetLeft", { value: chipBox.offsetLeft, configurable: true });
      Object.defineProperty(target, "clientWidth", { value: 120, configurable: true });
      target.getBoundingClientRect = () => rect({ left: chipBox.left, right: chipBox.right });

      return rail;
    }

    it("scrolls a chip that is off the right-hand edge into the middle", () => {
      renderMenu();
      const rail = stubRail({ left: 400, right: 520, offsetLeft: 400 });

      fireEvent.click(chip("Cakes"));

      // 400 - 320/2 + 120/2 — centred, and well inside the scrollable width.
      expect(rail.scrollTo).toHaveBeenCalledWith({ left: 300, behavior: "smooth" });
    });

    it("never scrolls past the start of the rail", () => {
      renderMenu();
      const rail = stubRail({ left: -200, right: -80, offsetLeft: 0 });

      fireEvent.click(chip("Cakes"));

      expect(rail.scrollTo).toHaveBeenCalledWith({ left: 0, behavior: "smooth" });
    });

    it("never scrolls past the end of the rail", () => {
      renderMenu();
      const rail = stubRail({ left: 880, right: 1000, offsetLeft: 880 });

      // Centring would want 820, but the rail can only scroll 900 - 320 = 580.
      fireEvent.click(chip("Cakes"));

      expect(rail.scrollTo).toHaveBeenCalledWith({ left: 580, behavior: "smooth" });
    });

    it("leaves the rail alone when the chip is already fully visible", () => {
      renderMenu();
      const rail = stubRail({ left: 120, right: 240, offsetLeft: 120 });

      fireEvent.click(chip("Cakes"));

      expect(rail.scrollTo).not.toHaveBeenCalled();
    });

    // On the very first paint the rail can still be mid-layout at zero width,
    // and centring against that throws the first chip half off the screen.
    it("does not centre against a rail that has not been laid out yet", () => {
      renderMenu();
      const rail = document.querySelector<HTMLElement>("[data-chip]")!.parentElement!;
      rail.scrollTo = vi.fn();

      fireEvent.click(chip("Cakes"));

      expect(rail.scrollTo).not.toHaveBeenCalled();
    });
  });
});
