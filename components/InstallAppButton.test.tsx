// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InstallAppButton from "./InstallAppButton";

const realUserAgent = navigator.userAgent;

function setUserAgent(value: string) {
  Object.defineProperty(navigator, "userAgent", { configurable: true, get: () => value });
}

function runningAsApp(standalone: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: standalone }) as unknown as typeof window.matchMedia;
}

/** What Chrome on Android fires once the page can be installed in one tap. */
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

afterEach(() => {
  setUserAgent(realUserAgent);
  Reflect.deleteProperty(window, "matchMedia");
});

describe("InstallAppButton", () => {
  it("is always offered in the browser, even before Chrome is ready", () => {
    render(<InstallAppButton shopName="Shivam Bakery" />);
    expect(screen.getByRole("button", { name: /install the shivam bakery app/i })).toBeInTheDocument();
  });

  it("shows Chrome's steps when tapped before Chrome can install in one tap", async () => {
    const user = userEvent.setup();
    setUserAgent("Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile");
    render(<InstallAppButton shopName="Shivam Bakery" />);

    const button = screen.getByRole("button", { name: /install/i });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await user.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/at the top right/i)).toBeInTheDocument();
    expect(screen.getByText(/install app/i, { selector: "strong" })).toBeInTheDocument();
  });

  it("shows Safari's steps on an iPhone", async () => {
    const user = userEvent.setup();
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1");
    render(<InstallAppButton shopName="Shivam Bakery" />);

    await user.click(screen.getByRole("button", { name: /install/i }));
    expect(screen.getByText(/add to home screen/i, { selector: "strong" })).toBeInTheDocument();
    expect(screen.queryByText(/at the top right/i)).not.toBeInTheDocument();
  });

  it("installs in one tap once Chrome offers it, keeping Chrome's own banner away", async () => {
    const user = userEvent.setup();
    render(<InstallAppButton shopName="Shivam Bakery" />);
    const event = offerInstall("accepted");
    expect(event.defaultPrevented).toBe(true);

    await user.click(screen.getByRole("button", { name: /install/i }));
    expect(event.prompt).toHaveBeenCalled();
    // Installed: nothing left to offer.
    expect(screen.queryByRole("button", { name: /install/i })).not.toBeInTheDocument();
  });

  it("stays available if the customer says not now", async () => {
    const user = userEvent.setup();
    render(<InstallAppButton shopName="Shivam Bakery" />);
    const event = offerInstall("dismissed");

    await user.click(screen.getByRole("button", { name: /install/i }));
    expect(event.prompt).toHaveBeenCalledTimes(1);
    // The one-tap offer is spent; another tap now shows the steps instead.
    await user.click(screen.getByRole("button", { name: /install/i }));
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  it("disappears once the app is installed another way", () => {
    render(<InstallAppButton shopName="Shivam Bakery" />);
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(screen.queryByRole("button", { name: /install/i })).not.toBeInTheDocument();
  });

  it("is not offered inside the installed app itself", () => {
    runningAsApp(true);
    const { container } = render(<InstallAppButton shopName="Shivam Bakery" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is offered in a browser tab that can tell it is not the app", () => {
    runningAsApp(false);
    render(<InstallAppButton shopName="Shivam Bakery" />);
    expect(screen.getByRole("button", { name: /install/i })).toBeInTheDocument();
  });

  it("stops listening once gone from the page", () => {
    const { unmount } = render(<InstallAppButton shopName="Shivam Bakery" />);
    unmount();
    expect(offerInstall().defaultPrevented).toBe(false);
  });
});
