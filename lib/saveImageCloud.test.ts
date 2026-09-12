import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Cloudinary half of saveImage, plus the link-resolution that runs before
 * it. The Cloudinary module is replaced so these stay fast and offline; the
 * real service is exercised separately.
 *
 * The sibling file saveImage.test.ts covers the same functions with Cloudinary
 * switched off, which is the local-disk path.
 */

let uploadFromUrlShouldFail = false;
let uploadShouldFail = false;
const deleted: string[] = [];
const uploadedFrom: string[] = [];
const uploadedNames: string[] = [];

vi.mock("./cloudinary", () => ({
  usingCloudinary: () => Boolean(process.env.CLOUDINARY_URL),
  uploadToCloudinary: async (_bytes: Buffer, filename: string) => {
    uploadedNames.push(filename);
    if (uploadShouldFail) throw new Error("upload refused");
    return { url: "https://res.cloudinary.com/c/image/upload/v1/bakery/file.jpg", publicId: "bakery/file" };
  },
  uploadToCloudinaryFromUrl: async (remote: string) => {
    uploadedFrom.push(remote);
    if (uploadFromUrlShouldFail) throw new Error("could not fetch remote file");
    return { url: "https://res.cloudinary.com/c/image/upload/v1/bakery/remote.jpg", publicId: "bakery/remote" };
  },
  deleteFromCloudinary: async (publicId: string) => {
    deleted.push(publicId);
  },
  publicIdFromUrl: (url: string) =>
    url.startsWith("https://res.cloudinary.com/") ? "bakery/remote" : null,
  CLOUDINARY_FOLDER: "bakery",
}));

const { deleteImage, saveImage, saveImageFromUrl } = await import("./saveImage");

const realFetch = globalThis.fetch;
const originalCloudinary = process.env.CLOUDINARY_URL;

/**
 * `Response.url` is a read-only getter, so it cannot be set on a real Response.
 * The resolver only reads that one field when following a short link.
 */
function landingOn(finalUrl: string): Response {
  return { url: finalUrl, ok: true, status: 200, headers: new Headers() } as unknown as Response;
}

function fakeFile(type: string, bytes: Uint8Array): File {
  return {
    type,
    size: bytes.byteLength,
    name: "cake.jpg",
    arrayBuffer: async () => bytes.buffer.slice(0) as ArrayBuffer,
  } as unknown as File;
}

beforeEach(() => {
  process.env.CLOUDINARY_URL = "cloudinary://key:secret@cloud";
  uploadFromUrlShouldFail = false;
  uploadShouldFail = false;
  deleted.length = 0;
  uploadedFrom.length = 0;
  uploadedNames.length = 0;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (originalCloudinary === undefined) delete process.env.CLOUDINARY_URL;
  else process.env.CLOUDINARY_URL = originalCloudinary;
});

describe("saveImage with Cloudinary configured", () => {
  it("stores the file in the cloud instead of on disk", async () => {
    const result = await saveImage(fakeFile("image/jpeg", new Uint8Array([1, 2, 3])));
    expect(result).toEqual({ url: expect.stringContaining("res.cloudinary.com") });
  });

  // Better to tell the owner than to save an item pointing at nothing.
  it("reports a failure rather than saving a broken reference", async () => {
    uploadShouldFail = true;
    expect(await saveImage(fakeFile("image/jpeg", new Uint8Array([1])))).toEqual({
      error: expect.stringMatching(/could not reach the image service/i),
    });
  });

  it("keeps the file's own name so the stored copy is recognisable", async () => {
    await saveImage(fakeFile("image/jpeg", new Uint8Array([1])));
    expect(uploadedNames).toEqual(["cake.jpg"]);
  });

  // A blob pasted rather than picked arrives with no name at all.
  it("falls back to a plain name when the file has none", async () => {
    const nameless = { ...fakeFile("image/jpeg", new Uint8Array([1])), name: "" } as File;

    await saveImage(nameless);

    expect(uploadedNames).toEqual(["upload"]);
  });

  it("still refuses a file of the wrong type before uploading anything", async () => {
    expect(await saveImage(fakeFile("application/pdf", new Uint8Array([1])))).toEqual({
      error: expect.stringContaining("JPG"),
    });
  });
});

describe("saveImageFromUrl with Cloudinary configured", () => {
  it("has Cloudinary fetch the address", async () => {
    const result = await saveImageFromUrl("https://example.com/cake.jpg");

    expect(uploadedFrom).toEqual(["https://example.com/cake.jpg"]);
    expect(result).toEqual({ url: expect.stringContaining("res.cloudinary.com") });
  });

  it("explains the failure when Cloudinary cannot fetch it", async () => {
    uploadFromUrlShouldFail = true;
    expect(await saveImageFromUrl("https://example.com/blocked.jpg")).toEqual({
      error: expect.stringMatching(/could not fetch that image/i),
    });
  });

  it("refuses a private address without asking Cloudinary at all", async () => {
    expect(await saveImageFromUrl("http://169.254.169.254/latest/meta-data/")).toEqual({
      error: expect.stringMatching(/private address/i),
    });
    expect(uploadedFrom, "must not hand a rejected address to Cloudinary").toEqual([]);
  });
});

/**
 * Both of these are what an ordinary copy-paste from Google Images produces,
 * so they matter more than they look.
 */
describe("resolving the address before uploading", () => {
  it("unwraps a google.com/imgres link to the real picture", async () => {
    const real = "https://floursandfrostings.com/wp-content/uploads/2018/03/cake.jpg";
    await saveImageFromUrl(
      "https://www.google.com/imgres?q=cake&imgurl=" + encodeURIComponent(real),
    );

    expect(uploadedFrom).toEqual([real]);
  });

  it("follows a share.google link and unwraps where it lands", async () => {
    const real = "https://example.com/photos/cake.jpg";
    globalThis.fetch = (async () =>
      landingOn("https://www.google.com/imgres?imgurl=" + encodeURIComponent(real))) as typeof fetch;

    await saveImageFromUrl("https://share.google/U86ksfehQYOUGe4jR");
    expect(uploadedFrom).toEqual([real]);
  });

  it("uses where a short link lands when it is already an image", async () => {
    globalThis.fetch = (async () => landingOn("https://cdn.example.com/cake.jpg")) as typeof fetch;

    await saveImageFromUrl("https://goo.gl/abc123");
    expect(uploadedFrom).toEqual(["https://cdn.example.com/cake.jpg"]);
  });

  it("reports a short link it cannot follow", async () => {
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as typeof fetch;

    expect(await saveImageFromUrl("https://share.google/broken")).toEqual({
      error: expect.stringMatching(/could not follow that short link/i),
    });
  });

  // Unwrapping must not become a way past the address check.
  it("refuses an imgres link whose inner address is private", async () => {
    const result = await saveImageFromUrl(
      "https://www.google.com/imgres?imgurl=" + encodeURIComponent("http://127.0.0.1:5432/"),
    );

    expect(result).toEqual({ error: expect.stringMatching(/private address/i) });
    expect(uploadedFrom).toEqual([]);
  });

  it("refuses a short link that lands on a private address", async () => {
    globalThis.fetch = (async () => landingOn("http://192.168.0.5/photo.jpg")) as typeof fetch;

    expect(await saveImageFromUrl("https://share.google/sneaky")).toEqual({
      error: expect.stringMatching(/private address/i),
    });
    expect(uploadedFrom).toEqual([]);
  });
});

describe("deleteImage for a cloud-hosted photo", () => {
  it("removes it from Cloudinary by id", async () => {
    await deleteImage("https://res.cloudinary.com/c/image/upload/v1/bakery/remote.jpg");
    expect(deleted).toEqual(["bakery/remote"]);
  });

  it("ignores an address belonging to neither store", async () => {
    await deleteImage("https://example.com/photo.jpg");
    expect(deleted).toEqual([]);
  });
});
