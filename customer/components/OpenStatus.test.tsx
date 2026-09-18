import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import OpenStatus from "./OpenStatus";
import type { ShopHours, ShopStatus } from "@/lib/hours";

/**
 * The Open/Closed badge. The whole point of this component is that it does not
 * go stale: a menu left open on a table must not still claim the shop is open
 * an hour after closing. That behaviour only shows up over time, so these
 * tests drive the clock rather than waiting.
 */

const hours: ShopHours = { open: "07:00", close: "21:00", closedDays: [] };

const openNow: ShopStatus = { isOpen: true, label: "Open now", detail: "7:00 am – 9:00 pm" };
const closedNow: ShopStatus = { isOpen: false, label: "Closed", detail: "Opens 7:00 am" };

/** Pins the shop's clock, which is what shopNow reads. */
function setShopTime(iso: string) {
  vi.setSystemTime(new Date(iso));
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("what it shows", () => {
  it("renders the status the server worked out, so the first paint is right", () => {
    setShopTime("2026-09-12T06:00:00Z"); // 11:30 in Kolkata — open
    render(<OpenStatus hours={hours} initial={openNow} />);

    expect(screen.getByText("Open now")).toBeInTheDocument();
    expect(screen.getByText("7:00 am – 9:00 pm")).toBeInTheDocument();
  });

  it("shows the closed state with its detail", () => {
    setShopTime("2026-09-11T22:00:00Z"); // 03:30 — closed
    render(<OpenStatus hours={hours} initial={closedNow} />);

    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.getByText("Opens 7:00 am")).toBeInTheDocument();
  });

  // A screen reader should hear the change once, not every time it re-checks.
  it("announces changes politely rather than interrupting", () => {
    setShopTime("2026-09-12T06:00:00Z");
    const { container } = render(<OpenStatus hours={hours} initial={openNow} />);

    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();
  });
});

describe("keeping itself current", () => {
  it("corrects a stale status handed down from the server", () => {
    // The server said open, but by the time this renders it is 11pm.
    setShopTime("2026-09-12T17:45:00Z"); // 23:15 in Kolkata
    render(<OpenStatus hours={hours} initial={openNow} />);

    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("flips to closed once the shop closes, without a reload", () => {
    setShopTime("2026-09-12T15:25:00Z"); // 20:55 — still open
    render(<OpenStatus hours={hours} initial={openNow} />);
    expect(screen.getByText("Open now")).toBeInTheDocument();

    // Ten past nine. A menu left on a table must not still say open.
    act(() => {
      setShopTime("2026-09-12T15:40:00Z");
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("flips to open when the shop opens", () => {
    setShopTime("2026-09-12T01:25:00Z"); // 06:55 — not yet
    render(<OpenStatus hours={hours} initial={closedNow} />);
    expect(screen.getByText("Closed")).toBeInTheDocument();

    act(() => {
      setShopTime("2026-09-12T01:35:00Z"); // 07:05
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByText("Open now")).toBeInTheDocument();
  });

  // Returning to a tab left open for hours is the commonest way to see a
  // stale badge, and it happens without any timer firing.
  it("re-checks when the page is brought back into view", () => {
    setShopTime("2026-09-12T15:25:00Z");
    render(<OpenStatus hours={hours} initial={openNow} />);
    expect(screen.getByText("Open now")).toBeInTheDocument();

    act(() => {
      setShopTime("2026-09-12T17:45:00Z");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("stops checking once it leaves the page", () => {
    setShopTime("2026-09-12T06:00:00Z");
    const { unmount } = render(<OpenStatus hours={hours} initial={openNow} />);

    unmount();

    // Nothing should still be scheduled; advancing must not throw or update.
    expect(() => act(() => vi.advanceTimersByTime(5 * 60_000))).not.toThrow();
  });
});

describe("a shop with a weekly off", () => {
  it("shows closed all day on the off day", () => {
    // 2026-09-13 is a Sunday.
    setShopTime("2026-09-13T06:00:00Z");
    render(
      <OpenStatus hours={{ ...hours, closedDays: [0] }} initial={openNow} />,
    );

    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.getByText("Closed today")).toBeInTheDocument();
  });
});
