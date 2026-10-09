import { afterEach, describe, expect, it } from "vitest";
import { ADMIN_THEME_COLOR, adminManifest, shortName } from "./appManifest";
import { GET } from "../app/admin-app.webmanifest/route";

describe("shortName", () => {
  it("keeps a name that fits under a home-screen icon", () => {
    expect(shortName("BAKERY NAME")).toBe("BAKERY NAME");
    expect(shortName("  Shivam  ")).toBe("Shivam");
  });

  it("shortens a long name", () => {
    expect(shortName("Shivam Bakery and Sweets")).toBe("Shivam Bake…");
  });

  it("falls back when there is no name", () => {
    expect(shortName("  ")).toBe("Bakery");
  });
});

describe("adminManifest", () => {
  it("opens the dashboard full screen in the shop's colours", () => {
    const manifest = adminManifest("Shivam Bakery");
    expect(manifest).toMatchObject({
      id: "/admin",
      name: "Shivam Bakery Admin",
      short_name: "Shivam Bake…",
      start_url: "/admin",
      scope: "/admin",
      display: "standalone",
      theme_color: ADMIN_THEME_COLOR,
    });
  });

  // What Chrome needs before it offers "Install app".
  it("has the icon sizes Android asks for, including one it can crop", () => {
    const { icons } = adminManifest("Shivam Bakery");
    expect(icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  });

  it("names a nameless shop sensibly", () => {
    expect(adminManifest("").name).toBe("Bakery Admin");
  });
});

describe("the manifest route", () => {
  const original = process.env.SHOP_NAME;
  afterEach(() => {
    if (original === undefined) delete process.env.SHOP_NAME;
    else process.env.SHOP_NAME = original;
  });

  it("serves the manifest for the configured shop", async () => {
    process.env.SHOP_NAME = "BAKERY NAME";
    const response = GET();

    expect(response.headers.get("content-type")).toBe("application/manifest+json; charset=utf-8");
    expect(await response.json()).toMatchObject({ name: "BAKERY NAME Admin", start_url: "/admin" });
  });

  it("still serves one with no shop name set", async () => {
    delete process.env.SHOP_NAME;
    expect(await GET().json()).toMatchObject({ name: "Bakery Admin" });
  });
});
