import type { Metadata } from "next";

// Nested under the menu's root layout, which owns <html> and <body>. This one
// does two things: keeps the dashboard out of search results — the menu is
// meant to be found, the owner's dashboard is not — and scopes the admin's
// palette so it cannot repaint the menu.
export const metadata: Metadata = {
  title: `Admin — ${process.env.SHOP_NAME ?? "Bakery"}`,
  description: "Manage the bakery menu.",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-theme min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      {children}
    </div>
  );
}
