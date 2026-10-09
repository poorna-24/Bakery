// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const { router } = vi.hoisted(() => ({ router: { refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const { default: AutoRefresh } = await import("./AutoRefresh");

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
}

beforeEach(() => {
  vi.useFakeTimers();
  document.title = "Admin — Shivam Bakery";
  setVisibility("visible");
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("AutoRefresh", () => {
  it("refreshes the page on a timer while someone is looking at it", () => {
    const { unmount } = render(<AutoRefresh seconds={20} newCount={0} />);

    vi.advanceTimersByTime(20_000);
    expect(router.refresh).toHaveBeenCalledTimes(1);

    setVisibility("hidden");
    vi.advanceTimersByTime(20_000);
    expect(router.refresh).toHaveBeenCalledTimes(1);

    unmount();
    setVisibility("visible");
    vi.advanceTimersByTime(60_000);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("counts new orders in the browser tab, and tidies up after", () => {
    const { rerender, unmount } = render(<AutoRefresh seconds={20} newCount={2} />);
    expect(document.title).toBe("(2) Admin — Shivam Bakery");

    rerender(<AutoRefresh seconds={20} newCount={3} />);
    expect(document.title).toBe("(3) Admin — Shivam Bakery");

    rerender(<AutoRefresh seconds={20} newCount={0} />);
    expect(document.title).toBe("Admin — Shivam Bakery");

    rerender(<AutoRefresh seconds={20} newCount={1} />);
    unmount();
    expect(document.title).toBe("Admin — Shivam Bakery");
  });
});
