// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { nav } = vi.hoisted(() => ({ nav: { usePathname: vi.fn(() => "/admin") } }));
vi.mock("next/navigation", () => nav);
vi.mock("next/link", async () => {
  const { forwardRef } = await import("react");
  const Link = forwardRef<HTMLAnchorElement, { href: string; children: React.ReactNode }>(
    ({ href, children, ...rest }, ref) => (
      <a ref={ref} href={href} {...rest}>
        {children}
      </a>
    ),
  );
  return { default: Link };
});

const { default: AdminNav, ADMIN_SECTIONS, activeSection } = await import("./AdminNav");

describe("activeSection", () => {
  it.each([
    ["/admin", "/admin"],
    ["/admin/orders", "/admin/orders"],
    ["/admin/qr", "/admin/qr"],
    // Editing a category or an item is still the menu.
    ["/admin/categories/c1", "/admin"],
    ["/admin/items/i1", "/admin"],
    // A section's own pages keep it lit, but a look-alike name does not.
    ["/admin/qr/table-card", "/admin/qr"],
    ["/admin/ordersheet", "/admin"],
  ])("puts %s under %s", (path, section) => {
    expect(activeSection(path)).toBe(section);
  });
});

describe("AdminNav", () => {
  it("lists every section in one row, with the current one marked and scrolled into view", () => {
    nav.usePathname.mockReturnValue("/admin/hours");
    const scrolled: string[] = [];
    // jsdom does not scroll; record what would be.
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.textContent ?? "");
    };
    render(<AdminNav />);
    expect(scrolled).toEqual(["Hours"]);

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(ADMIN_SECTIONS.map((section) => section.label));
    expect(screen.getByRole("link", { name: "Hours" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Menu" })).not.toHaveAttribute("aria-current");
    // A sideways-scrolling row, not wrapping lines.
    expect(screen.getByRole("navigation", { name: "Dashboard" })).toHaveClass("overflow-x-auto");
  });
});
