// The dashboard as an installable app. On Android, Chrome's "Install app" puts
// it on the home screen with its own icon, and it opens full screen on the
// dashboard — always the live site, so every deploy updates it with nothing
// to reinstall.

export const ADMIN_MANIFEST_PATH = "/admin-app.webmanifest";
export const ADMIN_THEME_COLOR = "#b4741f";
const BACKGROUND = "#f7f4ef";

/** The name under the home-screen icon: Android shows about twelve characters. */
export function shortName(shopName: string): string {
  const name = shopName.trim() || "Bakery";
  return name.length <= 12 ? name : `${name.slice(0, 11).trim()}…`;
}

export function adminManifest(shopName: string) {
  const name = shopName.trim() || "Bakery";
  return {
    // A fixed id keeps it the same installed app if the shop's name changes.
    id: "/admin",
    name: `${name} Admin`,
    short_name: shortName(name),
    description: `Manage ${name}'s menu, orders and settings.`,
    start_url: "/admin",
    // Links outside the dashboard (the customer menu, WhatsApp) open in the browser.
    scope: "/admin",
    display: "standalone",
    orientation: "portrait",
    background_color: BACKGROUND,
    theme_color: ADMIN_THEME_COLOR,
    icons: [
      { src: "/icons/admin-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/admin-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/admin-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

// The customer menu as an app of its own: a regular can keep the shop on
// their home screen and open it straight onto the menu and ordering. A
// different icon from the dashboard's, so the owner can tell the two apart.

export const MENU_MANIFEST_PATH = "/menu-app.webmanifest";
export const MENU_THEME_COLOR = "#fdf6ec";

export function menuManifest(shopName: string, tagline: string) {
  const name = shopName.trim() || "Bakery";
  return {
    id: "/",
    name,
    short_name: shortName(name),
    description: tagline.trim() || `The menu at ${name}.`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: MENU_THEME_COLOR,
    theme_color: MENU_THEME_COLOR,
    icons: [
      { src: "/icons/menu-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/menu-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/menu-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
