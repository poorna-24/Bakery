import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rateLimit";

describe("createRateLimiter", () => {
  it("allows up to the limit in the window, then refuses", () => {
    const allow = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(allow("a", 0)).toBe(true);
    expect(allow("a", 100)).toBe(true);
    expect(allow("a", 200)).toBe(false);
  });

  it("lets a key in again once its old hits age out", () => {
    const allow = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(allow("a", 0)).toBe(true);
    expect(allow("a", 999)).toBe(false);
    expect(allow("a", 1000)).toBe(true);
  });

  it("counts each key separately", () => {
    const allow = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(allow("a", 0)).toBe(true);
    expect(allow("b", 0)).toBe(true);
    expect(allow("a", 1)).toBe(false);
  });

  it("forgets quiet keys once it is tracking a great many", () => {
    const allow = createRateLimiter({ limit: 1, windowMs: 1000 });
    for (let i = 0; i <= 5000; i++) allow(`old${i}`, 0);
    // Long after the window, the busy check clears the stale keys out.
    expect(allow("fresh", 10_000)).toBe(true);
    expect(allow("old1", 10_000)).toBe(true);
  });

  it("uses the real clock when no time is given", () => {
    const allow = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(allow("a")).toBe(true);
    expect(allow("a")).toBe(false);
  });
});
