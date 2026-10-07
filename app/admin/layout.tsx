import type { Metadata } from "next";
import Backdrop from "@/components/Backdrop";
import { loadAppearance } from "@/lib/appearance";

// Nested under the menu's root layout, which owns <html> and <body>. This one
// keeps the dashboard out of search results — the menu is meant to be found,
// the owner's dashboard is not — scopes the admin's palette so it cannot
// repaint the menu, and paints the background chosen under Appearance so the
// dashboard wears the same look as the menu.
export const metadata: Metadata = {
  title: `Admin — ${process.env.SHOP_NAME ?? "Bakery"}`,
  description: "Manage the bakery menu.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const appearance = await loadAppearance();

  return (
    <div className="admin-theme min-h-dvh text-[var(--text)]">
      {/* The dashboard's own base colour, beneath the chosen background. On
          the wrapper itself it would paint over the backdrop and hide it. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-20 bg-[var(--bg)]" />
      <Backdrop appearance={appearance} />
      {children}
    </div>
  );
}
