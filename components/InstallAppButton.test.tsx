// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InstallAppButton from "./InstallAppButton";

/** What Chrome on Android fires when the page can be installed. */
function offerInstall(outcome: "accepted" | "dismissed" = "accepted") {
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

describe("InstallAppButton", () => {
  it("stays hidden where the browser cannot install the app", () => {
    const { container } = render(<InstallAppButton shopName="Shivam Bakery" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("offers the install once the browser can, keeping Chrome's own banner away", () => {
    render(<InstallAppButton shopName="Shivam Bakery" />);
    const event = offerInstall();

    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByRole("button", { name: /install the shivam bakery app/i })).toBeInTheDocument();
  });

  it("shows the install prompt when tapped, then goes away", async () => {
    const user = userEvent.setup();
    render(<InstallAppButton shopName="Shivam Bakery" />);
    const event = offerInstall("dismissed");

    await user.click(screen.getByRole("button", { name: /install/i }));
    expect(event.prompt).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /install/i })).not.toBeInTheDocument();
  });

  it("disappears once the app is installed another way", () => {
    render(<InstallAppButton shopName="Shivam Bakery" />);
    offerInstall();

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(screen.queryByRole("button", { name: /install/i })).not.toBeInTheDocument();
  });

  it("stops listening once gone from the page", () => {
    const { unmount } = render(<InstallAppButton shopName="Shivam Bakery" />);
    unmount();
    // Would throw a React state warning if a listener were left behind.
    const event = offerInstall();
    expect(event.defaultPrevented).toBe(false);
  });
});
