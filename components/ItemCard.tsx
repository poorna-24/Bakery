"use client";

import { useState } from "react";
import type { MenuItem } from "@/lib/types";
import { priceLabel } from "@/lib/types";
import VegMark from "./VegMark";

export default function ItemCard({ item, onOpen }: { item: MenuItem; onOpen: () => void }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-left transition-transform active:scale-[0.98]"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-[var(--line)]">
        {item.imageUrl ? (
          <>
            {!loaded && <div className="shimmer absolute inset-0" />}
            <img
              src={item.imageUrl}
              alt={item.name}
              loading="lazy"
              decoding="async"
              onLoad={() => setLoaded(true)}
              onError={() => setLoaded(true)}
              className={`h-full w-full object-cover transition-opacity duration-300 ${
                loaded ? "opacity-100" : "opacity-0"
              } ${item.isAvailable ? "" : "grayscale"}`}
            />
          </>
        ) : (
          <div className="grid h-full w-full place-items-center text-3xl opacity-40">🧁</div>
        )}

        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {item.isEggless && <Badge className="bg-emerald-600">EGGLESS</Badge>}
          {item.isBestseller && <Badge className="bg-amber-500">★ BESTSELLER</Badge>}
        </div>

        {!item.isAvailable && (
          <div className="absolute inset-0 grid place-items-center bg-black/45">
            <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-bold uppercase tracking-wide text-neutral-900">
              Sold out
            </span>
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-start gap-1.5">
          <VegMark isVeg={item.isVeg} />
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{item.name}</h3>
        </div>
        <p className="mt-1.5 text-sm font-bold text-[var(--accent)]">{priceLabel(item)}</p>
      </div>
    </button>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white ${className}`}>
      {children}
    </span>
  );
}
