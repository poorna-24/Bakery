import { afterEach, vi } from "vitest";

// Most of the admin's suites run in the node environment — the server actions
// and the lib helpers have no DOM. Only the component suites opt into jsdom
// with a `@vitest-environment` docblock, so everything here has to be guarded
// or those node suites fail before collecting a single test.
const hasDom = typeof window !== "undefined";

if (hasDom) {
  const { cleanup } = await import("@testing-library/react");
  await import("@testing-library/jest-dom/vitest");

  // Unmount between tests so a leftover DOM cannot make the next one pass.
  afterEach(() => cleanup());

  // jsdom implements neither of these, and the forms call them.
  Element.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

  // Object URLs back the image preview in the item form.
  if (!URL.createObjectURL) {
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
  }
}
