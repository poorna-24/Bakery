import { describe, expect, it } from "vitest";
import { publicIdFromUrl } from "./cloudinary";

// publicIdFromUrl is what makes deletion work: without the id recovered from
// the stored URL, replaced photos would pile up in the account forever.
describe("publicIdFromUrl", () => {
  it("reads the id out of a delivery url with transformations", () => {
    expect(
      publicIdFromUrl(
        "https://res.cloudinary.com/vl0mqfuz/image/upload/f_auto,q_auto/v1712345678/bakery/abc123.jpg",
      ),
    ).toBe("bakery/abc123");
  });

  it("reads the id when there are no transformations", () => {
    expect(
      publicIdFromUrl("https://res.cloudinary.com/vl0mqfuz/image/upload/v1712345678/bakery/abc.png"),
    ).toBe("bakery/abc");
  });

  it("keeps nested folders in the id", () => {
    expect(
      publicIdFromUrl(
        "https://res.cloudinary.com/vl0mqfuz/image/upload/v1/bakery/cakes/choco.webp",
      ),
    ).toBe("bakery/cakes/choco");
  });

  it("returns null for a local upload path, which is deleted from disk instead", () => {
    expect(publicIdFromUrl("/uploads/abc.jpg")).toBeNull();
  });

  it("returns null for some other host, so we never call destroy on a stranger's id", () => {
    expect(publicIdFromUrl("https://example.com/image/upload/v1/bakery/abc.jpg")).toBeNull();
  });

  it("returns null for an empty or malformed url", () => {
    expect(publicIdFromUrl("")).toBeNull();
    expect(publicIdFromUrl("https://res.cloudinary.com/vl0mqfuz/image/upload/")).toBeNull();
  });
});
