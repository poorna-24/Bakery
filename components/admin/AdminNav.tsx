"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export const ADMIN_SECTIONS = [
  { href: "/admin", label: "Menu" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/offers", label: "Offers" },
  { href: "/admin/hours", label: "Hours" },
  { href: "/admin/ordering", label: "Ordering" },
  { href: "/admin/appearance", label: "Appearance" },
  { href: "/admin/preview", label: "Preview" },
  { href: "/admin/qr", label: "QR code" },
] as const;

/**
 * Which section a dashboard address belongs to. Category and item pages are
 * part of the menu, so "Menu" stays lit while editing a cake.
 */
export function activeSection(pathname: string): string {
  const match = ADMIN_SECTIONS.find(
    (section) => section.href !== "/admin" && (pathname === section.href || pathname.startsWith(`${section.href}/`)),
  );
  return match ? match.href : "/admin";
}

/**
 * The dashboard's sections as one row. On a phone it scrolls sideways rather
 * than wrapping onto three lines, and the page you are on is lit.
 */
export default function AdminNav() {
  const active = activeSection(usePathname());
  const currentLink = useRef<HTMLAnchorElement>(null);

  // On a phone the row scrolls: bring the lit section into view, so "QR code"
  // is not hiding off the right edge while you are on it.
  useEffect(() => {
    currentLink.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [active]);

  return (
    <nav aria-label="Dashboard" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 pb-2.5 text-sm">
      {ADMIN_SECTIONS.map((section) => {
        const current = section.href === active;
        return (
          <Link
            key={section.href}
            ref={current ? currentLink : undefined}
            href={section.href}
            aria-current={current ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 transition-colors ${
              current
                ? "bg-[var(--accent)] font-semibold text-white"
                : "text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]"
            }`}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
