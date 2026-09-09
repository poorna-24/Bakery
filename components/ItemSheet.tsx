"use client";

import { useEffect } from "react";
import type { MenuItem } from "@/lib/types";
import { formatPrice } from "@/lib/types";
import VegMark from "./VegMark";

type Props = {
  item: MenuItem;
  phone: string;
  onClose: () => void;
};

export default function ItemSheet({ item, phone, onClose }: Props) {
  // Freeze the page behind the sheet, and let Escape / back-gesture close it.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const tags = [
    item.isVeg ? "Veg" : "Non-veg",
    item.isEggless ? "Eggless" : null,
    item.isBestseller ? "★ Bestseller" : null,
  ].filter(Boolean) as string[];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 animate-fadeIn bg-black/50"
      />

      <div className="relative max-h-[88dvh] w-full max-w-screen-sm animate-sheetUp overflow-y-auto rounded-t-3xl bg-[var(--surface)] pb-[env(safe-area-inset-bottom)]">
        <div className="sticky top-0 flex justify-center bg-[var(--surface)] pb-1 pt-3">
          <span className="h-1.5 w-11 rounded-full bg-[var(--line)]" />
        </div>

        {item.imageUrl && (
          <img
            src={item.imageUrl}
            alt={item.name}
            className={`mx-4 mt-1 aspect-[4/3] w-[calc(100%-2rem)] rounded-2xl object-cover ${
              item.isAvailable ? "" : "grayscale"
            }`}
          />
        )}

        <div className="px-5 pb-8 pt-4">
          <div className="flex items-start gap-2">
            <VegMark isVeg={item.isVeg} />
            <h2 className="text-xl font-bold leading-tight">{item.name}</h2>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-xs text-[var(--muted)]"
              >
                {tag}
              </span>
            ))}
            {!item.isAvailable && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                Sold out today
              </span>
            )}
          </div>

          {item.description && (
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{item.description}</p>
          )}

          <div className="mt-5 rounded-2xl border border-[var(--line)]">
            {item.variants.length > 0 ? (
              item.variants.map((variant, index) => (
                <div
                  key={variant.id}
                  className={`flex items-center justify-between px-4 py-3 ${
                    index > 0 ? "border-t border-[var(--line)]" : ""
                  }`}
                >
                  <span className="text-sm">{variant.label}</span>
                  <span className="font-bold text-[var(--accent)]">
                    {formatPrice(variant.price)}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[var(--muted)]">{item.unit}</span>
                <span className="text-lg font-bold text-[var(--accent)]">
                  {formatPrice(item.price)}
                </span>
              </div>
            )}
          </div>

          {phone && (
            <a
              href={`tel:${phone}`}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] py-3.5 font-semibold text-white"
            >
              <PhoneIcon />
              Call the shop
            </a>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full rounded-full border border-[var(--line)] py-3 text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
    </svg>
  );
}
