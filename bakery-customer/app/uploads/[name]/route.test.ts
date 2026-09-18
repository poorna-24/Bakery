import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { GET } from "./route";
import { uploadsDir } from "@/lib/storage";

/**
 * Item photos live in the shared data folder, outside the repo, so they cannot
 * be served from /public. This route reads them back for the menu.
 *
 * It reads a filename straight off the URL, and this app is the public one —
 * so it is where a stranger would try for a file outside that folder. The
 * refusals matter more here than the happy path.
 */

const dataDir = path.join(os.tmpdir(), `bakery-customer-route-${process.pid}`);
const original = process.env.BAKERY_DATA_DIR;

const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/** The route takes its params as a promise, the way Next hands them over. */
function request(name: string) {
  return GET(new Request(`http://localhost/uploads/${name}`), {
    params: Promise.resolve({ name }),
  });
}

beforeAll(async () => {
  process.env.BAKERY_DATA_DIR = dataDir;
  await mkdir(uploadsDir(), { recursive: true });
  await writeFile(path.join(uploadsDir(), "cake.png"), bytes);
  await writeFile(path.join(uploadsDir(), "photo.jpg"), bytes);
  await mkdir(path.join(uploadsDir(), "a-folder"), { recursive: true });
});

afterAll(async () => {
  await rm(dataDir, { recursive: true, force: true });
  if (original === undefined) delete process.env.BAKERY_DATA_DIR;
  else process.env.BAKERY_DATA_DIR = original;
});

describe("serving a photo", () => {
  it("returns the file with its own type", async () => {
    const response = await request("cake.png");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Content-Length")).toBe(String(bytes.byteLength));
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });

  it("reads the type from the name, not the bytes", async () => {
    const response = await request("photo.jpg");
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
  });

  // An upload gets a fresh random name, so a saved file never changes under
  // that name and can be cached as long as the browser likes.
  it("lets the browser cache it forever", async () => {
    const response = await request("cake.png");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
  });
});

describe("what it refuses", () => {
  it("returns 404 for a file that is not there", async () => {
    const response = await request("missing.png");
    expect(response.status).toBe(404);
  });

  it("returns 404 for a folder", async () => {
    const response = await request("a-folder");
    expect(response.status).toBe(404);
  });

  // The name comes off the URL, so this is the one place a stranger could try
  // to reach a file outside the uploads folder.
  it.each([
    ["../../../etc/passwd", "climbing out of the folder"],
    ["..%2F..%2Fsecret.env", "the same, url-encoded"],
    ["sub/dir/cake.png", "a path rather than a name"],
    ["cake.png\u0000.txt", "a null byte"],
    ["", "nothing at all"],
    [".", "the folder itself"],
    ["C:\\Windows\\win.ini", "an absolute Windows path"],
  ])("returns 404 for %s (%s)", async (name) => {
    const response = await request(name);
    expect(response.status).toBe(404);
  });

  it("refuses a name with no extension we serve", async () => {
    const response = await request("notes.txt");
    expect(response.status).toBe(404);
  });
});
