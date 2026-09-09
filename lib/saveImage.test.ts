import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { deleteImage, saveImage } from "./saveImage";
import { MAX_IMAGE_BYTES, uploadsDir } from "./storage";

// saveImage writes real files, so each test gets its own throwaway folder
// pointed at by BAKERY_DATA_DIR. Nothing here touches the shop's data.

const originalDataDir = process.env.BAKERY_DATA_DIR;
const originalCloudinary = process.env.CLOUDINARY_URL;
let dataDir: string;

/**
 * A stand-in for a browser File. Node 18 has no global File, and saveImage
 * only ever reads .type, .size and .arrayBuffer().
 */
function fakeFile(type: string, bytes: Uint8Array | number): File {
  const size = typeof bytes === "number" ? bytes : bytes.byteLength;
  const data = typeof bytes === "number" ? new Uint8Array(0) : bytes;

  return {
    type,
    size,
    arrayBuffer: async () => data.buffer.slice(0) as ArrayBuffer,
  } as unknown as File;
}

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "bakery-test-"));
  process.env.BAKERY_DATA_DIR = dataDir;
  // Force the local-disk path: these tests must never call out to Cloudinary.
  delete process.env.CLOUDINARY_URL;
});

afterEach(() => {
  if (originalDataDir === undefined) delete process.env.BAKERY_DATA_DIR;
  else process.env.BAKERY_DATA_DIR = originalDataDir;
  if (originalCloudinary === undefined) delete process.env.CLOUDINARY_URL;
  else process.env.CLOUDINARY_URL = originalCloudinary;
});

describe("saveImage", () => {
  it("does nothing when the form had no file attached", async () => {
    // The normal case when the owner edits a price and leaves the photo alone.
    expect(await saveImage(null)).toBeNull();
  });

  it("does nothing for an empty file", async () => {
    expect(await saveImage(fakeFile("image/jpeg", 0))).toBeNull();
  });

  it.each(["image/jpeg", "image/png", "image/webp", "image/avif"])(
    "accepts %s",
    async (type) => {
      const result = await saveImage(fakeFile(type, new Uint8Array([1, 2, 3])));
      expect(result).not.toBeNull();
      expect(result).not.toHaveProperty("error");
    },
  );

  it.each(["application/pdf", "text/html", "image/svg+xml", "application/x-msdownload"])(
    "refuses %s",
    async (type) => {
      const result = await saveImage(fakeFile(type, new Uint8Array([1, 2, 3])));
      expect(result).toEqual({ error: expect.stringContaining("JPG") });
    },
  );

  it("refuses a file over the size limit", async () => {
    const result = await saveImage(fakeFile("image/jpeg", MAX_IMAGE_BYTES + 1));
    expect(result).toEqual({ error: expect.stringContaining("5 MB") });
  });

  it("accepts a file exactly on the limit", async () => {
    const result = await saveImage(fakeFile("image/jpeg", MAX_IMAGE_BYTES));
    expect(result).not.toHaveProperty("error");
  });

  it("writes the bytes it was given", async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x42]);
    const result = await saveImage(fakeFile("image/jpeg", bytes));

    if (!result || "error" in result) throw new Error("expected a saved file");

    const onDisk = await readFile(path.join(uploadsDir(), path.basename(result.url)));
    expect(new Uint8Array(onDisk)).toEqual(bytes);
  });

  it("returns a url the customer app can serve", async () => {
    const result = await saveImage(fakeFile("image/png", new Uint8Array([1])));
    if (!result || "error" in result) throw new Error("expected a saved file");

    expect(result.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
  });

  it("gives each upload its own name, so one never overwrites another", async () => {
    const a = await saveImage(fakeFile("image/jpeg", new Uint8Array([1])));
    const b = await saveImage(fakeFile("image/jpeg", new Uint8Array([2])));

    if (!a || "error" in a || !b || "error" in b) throw new Error("expected two saved files");

    expect(a.url).not.toBe(b.url);
    expect(await readdir(uploadsDir())).toHaveLength(2);
  });

  it("creates the uploads folder on first use", async () => {
    // dataDir exists but has no uploads/ inside it yet.
    const result = await saveImage(fakeFile("image/jpeg", new Uint8Array([1])));
    expect(result).not.toHaveProperty("error");
    expect(await readdir(uploadsDir())).toHaveLength(1);
  });
});

describe("deleteImage", () => {
  it("removes the file", async () => {
    const saved = await saveImage(fakeFile("image/jpeg", new Uint8Array([1])));
    if (!saved || "error" in saved) throw new Error("expected a saved file");

    await deleteImage(saved.url);
    expect(await readdir(uploadsDir())).toHaveLength(0);
  });

  it("shrugs off a file that is already gone", async () => {
    await expect(deleteImage("/uploads/does-not-exist.jpg")).resolves.toBeUndefined();
  });

  it("ignores null and empty urls", async () => {
    await expect(deleteImage(null)).resolves.toBeUndefined();
    await expect(deleteImage(undefined)).resolves.toBeUndefined();
    await expect(deleteImage("")).resolves.toBeUndefined();
  });

  it("ignores a url that is not an upload", async () => {
    await expect(deleteImage("https://example.com/photo.jpg")).resolves.toBeUndefined();
  });

  // The important one: a stored url should never be able to reach outside the
  // uploads folder, however it got into the database.
  it("refuses to follow a traversal path out of the uploads folder", async () => {
    const victim = path.join(dataDir, "bakery.db");
    await writeFile(victim, "pretend database");

    await deleteImage("/uploads/../bakery.db");

    await expect(readFile(victim, "utf8")).resolves.toBe("pretend database");
  });
});
