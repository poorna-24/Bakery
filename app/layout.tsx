import type { Metadata, Viewport } from "next";
import "./globals.css";

const shopName = process.env.NEXT_PUBLIC_SHOP_NAME ?? "Our Bakery";
const tagline = process.env.NEXT_PUBLIC_SHOP_TAGLINE ?? "Freshly baked every morning.";

export const metadata: Metadata = {
  title: `Menu — ${shopName}`,
  description: tagline,
  // Scanned from a table card, so it should look right if anyone shares the link.
  openGraph: { title: `Menu — ${shopName}`, description: tagline, type: "website" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The menu is a document, not an app — let people pinch-zoom the prices.
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdf6ec" },
    { media: "(prefers-color-scheme: dark)", color: "#17110c" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
