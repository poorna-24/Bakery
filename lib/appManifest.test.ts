import { afterEach, describe, expect, it } from "vitest";
import { ADMIN_THEME_COLOR, MENU_THEME_COLOR, adminManifest, menuManifest, shortName } from "./appManifest";
import { GET } from "../app/admin-app.webmanifest/route";
import { GET as menuGET } from "../app/menu-app.webmanifest/route";

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

describe("menuManifest", () => {
  it("opens the customer menu as an app, in the menu's cream", () => {
    expect(menuManifest("Shivam Bakery", " Fresh every morning. ")).toMatchObject({
      id: "/",
      name: "Shivam Bakery",
      short_name: "Shivam Bake…",
      description: "Fresh every morning.",
      start_url: "/",
      scope: "/",
      display: "standalone",
      theme_color: MENU_THEME_COLOR,
    });
  });

  it("uses its own icons, so it is not mistaken for the dashboard", () => {
    const icons = menuManifest("S", "").icons.map((icon) => icon.src);
    expect(icons.every((src) => src.startsWith("/icons/menu-"))).toBe(true);
    expect(menuManifest("S", "").icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  });

  it("describes itself when there is no tagline, and copes with no name", () => {
    expect(menuManifest("", "").description).toBe("The menu at Bakery.");
  });
});

describe("the menu manifest route", () => {
  const originalName = process.env.SHOP_NAME;
  const originalTagline = process.env.SHOP_TAGLINE;
  afterEach(() => {
    for (const [key, value] of [
      ["SHOP_NAME", originalName],
      ["SHOP_TAGLINE", originalTagline],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("serves the menu manifest for the configured shop", async () => {
    process.env.SHOP_NAME = "BAKERY NAME";
    process.env.SHOP_TAGLINE = "Handcrafted delights.";
    const response = menuGET();
    expect(response.headers.get("content-type")).toBe("application/manifest+json; charset=utf-8");
    expect(await response.json()).toMatchObject({ name: "BAKERY NAME", description: "Handcrafted delights." });
  });

  it("still serves one with nothing configured", async () => {
    delete process.env.SHOP_NAME;
    delete process.env.SHOP_TAGLINE;
    expect(await menuGET().json()).toMatchObject({ name: "Bakery", start_url: "/" });
  });
});
