import { describe, expect, it } from "vitest";
import { contentTypeFor, extensionFor, safeFileName } from "./storage";

describe("safeFileName", () => {
  it("accepts the uuid names uploads are actually given", () => {
    expect(safeFileName("0b2d9256-d82e-42ec-8f0e-0abc869e5d58.jpg")).toBe(
      "0b2d9256-d82e-42ec-8f0e-0abc869e5d58.jpg",
    );
  });

  // This guard is the whole reason the function exists: the name arrives from
  // the URL, and the route joins it onto a folder path on disk.
  it.each([
    ["../../.env", "parent traversal"],
    ["..\\..\\windows\\system32", "windows traversal"],
    ["sub/dir/photo.jpg", "forward slash"],
    ["sub\\dir\\photo.jpg", "backslash"],
    ["..", "bare dots"],
    ["photo..jpg", "double dot inside the name"],
  ])("rejects %s (%s)", (name) => {
    expect(safeFileName(name)).toBeNull();
  });

  it("rejects an empty name", () => {
    expect(safeFileName("")).toBeNull();
  });

  it("rejects names with characters uploads never produce", () => {
    expect(safeFileName("photo;rm -rf.jpg")).toBeNull();
    expect(safeFileName("photo file.jpg")).toBeNull();
  });
});

describe("extensionFor", () => {
  it("maps the types the upload form accepts", () => {
    expect(extensionFor("image/png")).toBe(".png");
    expect(extensionFor("image/webp")).toBe(".webp");
    expect(extensionFor("image/avif")).toBe(".avif");
    expect(extensionFor("image/jpeg")).toBe(".jpg");
  });

  it("falls back to .jpg for anything unexpected", () => {
    expect(extensionFor("application/octet-stream")).toBe(".jpg");
  });
});

describe("contentTypeFor", () => {
  it("reads the type back off the stored file name", () => {
    expect(contentTypeFor("a.png")).toBe("image/png");
    expect(contentTypeFor("a.webp")).toBe("image/webp");
    expect(contentTypeFor("a.avif")).toBe("image/avif");
    expect(contentTypeFor("a.jpg")).toBe("image/jpeg");
  });

  it("ignores the case of the extension", () => {
    expect(contentTypeFor("PHOTO.PNG")).toBe("image/png");
  });

  it("defaults to jpeg when there is no extension", () => {
    expect(contentTypeFor("photo")).toBe("image/jpeg");
  });

  it("round-trips with extensionFor for every accepted type", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/avif"]) {
      expect(contentTypeFor(`file${extensionFor(type)}`)).toBe(type);
    }
  });
});
