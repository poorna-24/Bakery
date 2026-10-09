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
