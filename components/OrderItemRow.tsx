"use client";

import { useState } from "react";
import type { MenuItem } from "@/lib/types";
import { formatPrice } from "@/lib/types";
import { lineKey, qtyOf, type Cart } from "@/lib/ordering";
import VegMark from "./VegMark";
import QtyStepper from "./QtyStepper";

type Props = {
  item: MenuItem;
  cart: Cart;
  onAdd: (line: { itemId: string; name: string; size: string | null; price: number }) => void;
  onChange: (key: string, delta: number) => void;
};

/**
 * One item on the ordering tab: a compact row rather than the menu's photo
 * card, so a customer can run down the list adding things without scrolling
 * past a picture for each one.
 */
export default function OrderItemRow({ item, cart, onAdd, onChange }: Props) {
  const [sizeIndex, setSizeIndex] = useState(0);

  const variant = item.variants[sizeIndex] ?? null;
  const size = variant ? variant.label : null;
  const price = variant ? variant.price : item.price;
  const qty = qtyOf(cart, item.id, size);
  const label = size ? `${item.name} (${size})` : item.name;

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2.5 ${
        item.isAvailable ? "" : "opacity-60"
      }`}
    >
      <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-[var(--bg)]">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            className={`h-full w-full object-cover ${item.isAvailable ? "" : "grayscale"}`}
          />
        ) : (
          <span className="text-2xl opacity-40">🧁</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5">
          <VegMark isVeg={item.isVeg} />
          <p className="text-sm font-semibold leading-snug">{item.name}</p>
        </div>

        {item.variants.length > 1 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label={`Size of ${item.name}`}>
            {item.variants.map((option, index) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSizeIndex(index)}
                aria-pressed={index === sizeIndex}
                className={`rounded-lg border px-2 py-0.5 text-xs ${
                  index === sizeIndex
                    ? "border-[var(--accent)] bg-[var(--bg)] font-semibold"
                    : "border-[var(--line)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
        {item.variants.length === 1 && (
          <p className="mt-0.5 text-xs text-[var(--muted)]">{item.variants[0].label}</p>
        )}

        <p className="mt-1 text-sm font-bold text-[var(--accent)]">{formatPrice(price)}</p>
      </div>

      {!item.isAvailable ? (
        <span className="shrink-0 text-xs font-semibold text-[var(--muted)]">Sold out</span>
      ) : qty === 0 ? (
        <button
          type="button"
          onClick={() => onAdd({ itemId: item.id, name: item.name, size, price })}
          aria-label={`Add ${label}`}
          className="shrink-0 rounded-xl border border-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--accent)]"
        >
          Add
        </button>
      ) : (
        <QtyStepper qty={qty} label={label} onChange={(delta) => onChange(lineKey(item.id, size), delta)} />
      )}
    </div>
  );
}
