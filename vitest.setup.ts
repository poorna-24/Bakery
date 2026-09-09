import { afterEach, vi } from "vitest";

// Runs before every suite, including the ones that use the node environment
// (the spec tests). Anything touching the DOM has to be guarded, or those
// suites fail before collecting a single test.
const hasDom = typeof window !== "undefined";

if (hasDom) {
  const { cleanup } = await import("@testing-library/react");
  await import("@testing-library/jest-dom/vitest");

  // Unmount between tests so a leftover DOM cannot make the next one pass.
  afterEach(() => cleanup());

  // jsdom implements none of these, and the menu calls them on mount.
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  }

  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.scrollTo = vi.fn() as unknown as Element["scrollTo"];
}
