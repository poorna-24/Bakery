// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Footer from "./Footer";

const base = {
  shopName: "Shivam Bakery",
  address: "Cherial, Telangana",
  mapUrl: "https://maps.example/shop",
  phone: "+91 76660 93143",
  whatsapp: "",
  credit: { name: "", whatsapp: "" },
};

/** The row the contact tiles share. */
function tileRow(): HTMLElement {
  return screen.getByRole("link", { name: "Get directions" }).parentElement!;
}

describe("Footer", () => {
  it("puts the three ways in side by side, short on the tile and full for screen readers", () => {
    render(<Footer {...base} />);

    const directions = screen.getByRole("link", { name: "Get directions" });
    expect(directions).toHaveTextContent("Directions");
    expect(directions).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "Message on WhatsApp" })).toHaveTextContent("WhatsApp");

    const call = screen.getByRole("link", { name: "Call +91 76660 93143" });
    expect(call).toHaveTextContent("Call");
    expect(call).toHaveAttribute("href", "tel:+917666093143");
    // The dialler opens in place, not in a new tab.
    expect(call).not.toHaveAttribute("target");

    expect(tileRow().style.gridTemplateColumns).toBe("repeat(3, minmax(0, 1fr))");
  });

  it("shares the row between only the ways that are set up", () => {
    render(<Footer {...base} phone="" />);
    expect(screen.queryByRole("link", { name: /call/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /whatsapp/i })).not.toBeInTheDocument();
    expect(tileRow().style.gridTemplateColumns).toBe("repeat(1, minmax(0, 1fr))");
  });

  it("leaves the row out when there is no way to get in touch", () => {
    render(<Footer {...base} mapUrl="" phone="" address="" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText("Cherial, Telangana")).not.toBeInTheDocument();
  });

  it("says the shop is open, in green", () => {
    render(<Footer {...base} status={{ isOpen: true, label: "Open now", detail: "7:00 am – 9:00 pm" }} />);
    const badge = screen.getByText(/open now · 7:00 am – 9:00 pm/i);
    expect(badge).toHaveClass("bg-emerald-50");
  });

  it("says the shop is closed, in red", () => {
    render(<Footer {...base} status={{ isOpen: false, label: "Closed", detail: "Opens 7:00 am" }} />);
    expect(screen.getByText(/closed · opens 7:00 am/i)).toHaveClass("bg-red-50");
  });

  it("shows no badge until opening hours are set", () => {
    render(<Footer {...base} />);
    expect(screen.queryByText(/open now|closed/i)).not.toBeInTheDocument();
  });
});
