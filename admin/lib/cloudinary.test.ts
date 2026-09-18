import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Cloudinary wrapper. The SDK itself is replaced — these tests are about
 * what we ask it for and what we do with the answer, not about whether
 * Cloudinary works. Calling the real service from a unit test would make the
 * suite slow, flaky, and dependent on someone's API quota.
 */

const uploadStreamCalls: Record<string, unknown>[] = [];
const uploadCalls: Array<[string, Record<string, unknown>]> = [];
const destroyCalls: Array<[string, Record<string, unknown>]> = [];
const urlCalls: Array<[string, Record<string, unknown>]> = [];

let uploadShouldFail = false;
let uploadReturnsNothing = false;
let destroyShouldFail = false;

vi.mock("cloudinary", () => {
  const uploader = {
    upload_stream: (
      options: Record<string, unknown>,
      done: (error: unknown, result?: unknown) => void,
    ) => {
      uploadStreamCalls.push(options);
      return {
        end: () => {
          if (uploadReturnsNothing) done(null, undefined);
          else if (uploadShouldFail) done(new Error("upload refused"));
          else done(null, { secure_url: "https://res.cloudinary.com/x/a.jpg", public_id: "bakery/a" });
        },
      };
    },
    upload: async (remote: string, options: Record<string, unknown>) => {
      uploadCalls.push([remote, options]);
      if (uploadShouldFail) throw new Error("could not fetch remote file");
      return { secure_url: "https://res.cloudinary.com/x/b.jpg", public_id: "bakery/b" };
    },
    destroy: async (publicId: string, options: Record<string, unknown>) => {
      destroyCalls.push([publicId, options]);
      if (destroyShouldFail) throw new Error("destroy failed");
      return { result: "ok" };
    },
  };

  return {
    v2: {
      config: () => ({}),
      uploader,
      url: (publicId: string, options: Record<string, unknown>) => {
        urlCalls.push([publicId, options]);
        return `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/${publicId}`;
      },
    },
  };
});

const {
  CLOUDINARY_FOLDER,
  deleteFromCloudinary,
  deliveryUrl,
  publicIdFromUrl,
  uploadToCloudinary,
  uploadToCloudinaryFromUrl,
  usingCloudinary,
} = await import("./cloudinary");

const originalUrl = process.env.CLOUDINARY_URL;

beforeEach(() => {
  uploadStreamCalls.length = 0;
  uploadCalls.length = 0;
  destroyCalls.length = 0;
  urlCalls.length = 0;
  uploadShouldFail = false;
  uploadReturnsNothing = false;
  destroyShouldFail = false;
});

afterEach(() => {
  if (originalUrl === undefined) delete process.env.CLOUDINARY_URL;
  else process.env.CLOUDINARY_URL = originalUrl;
});

describe("usingCloudinary", () => {
  it("is true when credentials are configured", () => {
    process.env.CLOUDINARY_URL = "cloudinary://key:secret@cloud";
    expect(usingCloudinary()).toBe(true);
  });

  // This is the switch that lets the same code run on a laptop with no
  // accounts and on Vercel, where there is no disk to write to.
  it("is false when they are not, so uploads fall back to disk", () => {
    delete process.env.CLOUDINARY_URL;
    expect(usingCloudinary()).toBe(false);
  });

  it("is false for an empty value, not just a missing one", () => {
    process.env.CLOUDINARY_URL = "";
    expect(usingCloudinary()).toBe(false);
  });
});

describe("uploadToCloudinary", () => {
  it("returns a delivery url for the stored image", async () => {
    const result = await uploadToCloudinary(Buffer.from([1, 2, 3]), "cake.jpg");
    expect(result).toEqual({
      url: expect.stringContaining("bakery/a"),
      publicId: "bakery/a",
    });
  });

  it("files everything under one folder", async () => {
    await uploadToCloudinary(Buffer.from([1]), "cake.jpg");
    expect(uploadStreamCalls[0]).toMatchObject({ folder: CLOUDINARY_FOLDER });
  });

  // A filename arriving from a form is not an identifier: two items called
  // cake.jpg must not overwrite each other.
  it("never derives the stored name from the uploaded filename", async () => {
    await uploadToCloudinary(Buffer.from([1]), "cake.jpg");
    expect(uploadStreamCalls[0]).toMatchObject({
      use_filename: false,
      unique_filename: true,
      overwrite: false,
    });
  });

  it("rejects when the upload fails, rather than returning a broken url", async () => {
    uploadShouldFail = true;
    await expect(uploadToCloudinary(Buffer.from([1]), "cake.jpg")).rejects.toThrow();
  });

  // The SDK's callback types allow both to be absent. Resolving with nothing
  // would hand back an item whose photo address is undefined.
  it("rejects when the SDK reports neither an error nor a result", async () => {
    uploadReturnsNothing = true;

    await expect(uploadToCloudinary(Buffer.from([1]), "cake.jpg")).rejects.toThrow(
      /returned no result/i,
    );
  });
});

describe("uploadToCloudinaryFromUrl", () => {
  it("hands the address to Cloudinary to fetch", async () => {
    const result = await uploadToCloudinaryFromUrl("https://example.com/cake.jpg");

    expect(uploadCalls[0][0]).toBe("https://example.com/cake.jpg");
    expect(result.publicId).toBe("bakery/b");
  });

  it("uses the same folder and naming rules as a file upload", async () => {
    await uploadToCloudinaryFromUrl("https://example.com/cake.jpg");
    expect(uploadCalls[0][1]).toMatchObject({
      folder: CLOUDINARY_FOLDER,
      use_filename: false,
      unique_filename: true,
      overwrite: false,
    });
  });

  it("rejects when Cloudinary cannot fetch the address", async () => {
    uploadShouldFail = true;
    await expect(uploadToCloudinaryFromUrl("https://example.com/gone.jpg")).rejects.toThrow();
  });
});

describe("deliveryUrl", () => {
  // Auto format and quality are what let a phone on a weak connection get a
  // small WebP without the owner thinking about formats.
  it("asks for automatic format and quality", () => {
    deliveryUrl("bakery/abc");
    expect(urlCalls[0][1]).toMatchObject({
      secure: true,
      fetch_format: "auto",
      quality: "auto",
    });
  });

  it("returns an https address", () => {
    expect(deliveryUrl("bakery/abc")).toMatch(/^https:\/\//);
  });
});

describe("deleteFromCloudinary", () => {
  it("removes the image by id", async () => {
    await deleteFromCloudinary("bakery/abc");
    expect(destroyCalls[0]).toEqual(["bakery/abc", { resource_type: "image" }]);
  });

  // Losing a stale file is not worth failing the owner's save for.
  it("swallows a failure rather than breaking the save that triggered it", async () => {
    destroyShouldFail = true;
    await expect(deleteFromCloudinary("bakery/abc")).resolves.toBeUndefined();
  });
});

describe("publicIdFromUrl", () => {
  it("reads the id from a delivery url with transformations", () => {
    expect(
      publicIdFromUrl("https://res.cloudinary.com/c/image/upload/f_auto,q_auto/v1/bakery/abc.jpg"),
    ).toBe("bakery/abc");
  });

  it("reads it when there are no transformations", () => {
    expect(publicIdFromUrl("https://res.cloudinary.com/c/image/upload/v1712/bakery/abc.png")).toBe(
      "bakery/abc",
    );
  });

  it("keeps nested folders", () => {
    expect(
      publicIdFromUrl("https://res.cloudinary.com/c/image/upload/v1/bakery/cakes/choco.webp"),
    ).toBe("bakery/cakes/choco");
  });

  it("returns null for a local upload path, deleted from disk instead", () => {
    expect(publicIdFromUrl("/uploads/abc.jpg")).toBeNull();
  });

  // Never call destroy with an id derived from somebody else's address.
  it("returns null for another host", () => {
    expect(publicIdFromUrl("https://example.com/image/upload/v1/bakery/abc.jpg")).toBeNull();
  });

  it("returns null for an empty or truncated url", () => {
    expect(publicIdFromUrl("")).toBeNull();
    expect(publicIdFromUrl("https://res.cloudinary.com/c/image/upload/")).toBeNull();
  });

  it("returns null when the path has no upload segment", () => {
    expect(publicIdFromUrl("https://res.cloudinary.com/c/video/play/v1/bakery/a.mp4")).toBeNull();
  });
});
