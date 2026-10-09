// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * The frame every admin page sits in: the navigation, the title, and signing
 * out. Signing out is the part worth pinning — it is a server action, so a
 * stale session must be destroyed rather than just navigated away from.
 */

const { auth, nav } = vi.hoisted(() => ({
  auth: { destroySession: vi.fn() },
  nav: { redirect: vi.fn(), usePathname: vi.fn(() => "/admin/orders") },
}));
vi.mock("@/lib/auth", () => auth);
vi.mock("next/navigation", () => nav);
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { default: Shell } = await import("./Shell");

const originalShopName = process.env.SHOP_NAME;

beforeEach(() => {
  process.env.SHOP_NAME = "SHIVAM BAKERY";
});

afterEach(() => {
  vi.clearAllMocks();
  if (originalShopName === undefined) delete process.env.SHOP_NAME;
  else process.env.SHOP_NAME = originalShopName;
});

describe("the version label", () => {
  const saved = {
    sha: process.env.VERCEL_GIT_COMMIT_SHA,
    label: process.env.ENVIRONMENT_LABEL,
  };

  afterEach(() => {
    for (const [key, value] of [
      ["VERCEL_GIT_COMMIT_SHA", saved.sha],
      ["ENVIRONMENT_LABEL", saved.label],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("shows the deployed commit, shortened", () => {
    process.env.VERCEL_GIT_COMMIT_SHA = "4e095c7e36b0cc1b1bade32018da301a85eb7235";
    delete process.env.ENVIRONMENT_LABEL;
    render(<Shell title="Menu">x</Shell>);
    expect(screen.getByText("Version 4e095c7")).toBeInTheDocument();
  });

  it("names the environment on QA", () => {
    process.env.VERCEL_GIT_COMMIT_SHA = "4e095c7e36b0cc1b1bade32018da301a85eb7235";
    process.env.ENVIRONMENT_LABEL = "QA";
    render(<Shell title="Menu">x</Shell>);
    expect(screen.getByText("Version 4e095c7 · QA")).toBeInTheDocument();
  });

  it("says local when it is not a Vercel build", () => {
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.ENVIRONMENT_LABEL;
    render(<Shell title="Menu">x</Shell>);
    expect(screen.getByText("Version local")).toBeInTheDocument();
  });
});

describe("the frame", () => {
  it("shows the title and the page's own content", () => {
    render(
      <Shell title="Menu">
        <p>Inside the shell</p>
      </Shell>,
    );

    expect(screen.getByRole("heading", { name: "Menu" })).toBeInTheDocument();
    expect(screen.getByText("Inside the shell")).toBeInTheDocument();
  });

  it("names the shop in the corner", () => {
    render(<Shell title="Menu">content</Shell>);
    expect(screen.getByRole("link", { name: "SHIVAM BAKERY Admin" })).toBeInTheDocument();
  });

  // A missing name should read as a generic admin, not "undefined Admin".
  it("falls back to a plain name when none is configured", () => {
    delete process.env.SHOP_NAME;

    render(<Shell title="Menu">content</Shell>);

    expect(screen.getByRole("link", { name: "Bakery Admin" })).toBeInTheDocument();
  });

  it("links to every section", () => {
    render(<Shell title="Menu">content</Shell>);

    const bar = screen.getByRole("navigation");
    expect(within(bar).getByRole("link", { name: "Menu" })).toHaveAttribute("href", "/admin");
    expect(within(bar).getByRole("link", { name: "Offers" })).toHaveAttribute("href", "/admin/offers");
    expect(within(bar).getByRole("link", { name: "Hours" })).toHaveAttribute("href", "/admin/hours");
    expect(within(bar).getByRole("link", { name: "Ordering" })).toHaveAttribute("href", "/admin/ordering");
    expect(within(bar).getByRole("link", { name: "Orders" })).toHaveAttribute("href", "/admin/orders");
    expect(within(bar).getByRole("link", { name: "Appearance" })).toHaveAttribute(
      "href",
      "/admin/appearance",
    );
    expect(within(bar).getByRole("link", { name: "Preview" })).toHaveAttribute("href", "/admin/preview");
    expect(within(bar).getByRole("link", { name: "QR code" })).toHaveAttribute("href", "/admin/qr");
  });
});

describe("the optional pieces", () => {
  it("shows a way back when one is given", () => {
    render(
      <Shell title="Cakes" back={{ href: "/", label: "All categories" }}>
        content
      </Shell>,
    );

    expect(screen.getByRole("link", { name: "← All categories" })).toHaveAttribute("href", "/");
  });

  it("leaves it out when there is nowhere to go back to", () => {
    render(<Shell title="Menu">content</Shell>);
    expect(screen.queryByRole("link", { name: /←/ })).not.toBeInTheDocument();
  });

  it("shows a page action beside the title when one is given", () => {
    render(
      <Shell title="Cakes" action={<button type="button">Add item</button>}>
        content
      </Shell>,
    );

    expect(screen.getByRole("button", { name: "Add item" })).toBeInTheDocument();
  });
});

describe("signing out", () => {
  // Navigating to /login without destroying the session would leave the cookie
  // valid — the next visit would walk straight back in.
  it("destroys the session and sends the owner to the login page", async () => {
    const user = userEvent.setup();
    render(<Shell title="Menu">content</Shell>);

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(auth.destroySession).toHaveBeenCalled());
    expect(nav.redirect).toHaveBeenCalledWith("/admin/login");
  });
});
