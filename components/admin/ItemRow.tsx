"use client";

import Link from "next/link";
import { useState } from "react";
import { deleteItem, moveItem, toggleItemAvailable } from "@/app/admin/actions";

type Item = {
  id: string;
  name: string;
  imageUrl: string | null;
  isAvailable: boolean;
  isVeg: boolean;
  isEggless: boolean;
  isBestseller: boolean;
  priceText: string;
};

export default function ItemRow({
  item,
  isFirst,
  isLast,
}: {
  item: Item;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex items-center gap-3 p-3">
      <div className="flex flex-col">
        <Move id={item.id} direction="up" disabled={isFirst} />
        <Move id={item.id} direction="down" disabled={isLast} />
      </div>

      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--bg)]">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt=""
            className={`h-full w-full object-cover ${item.isAvailable ? "" : "grayscale"}`}
          />
        ) : (
          <span className="grid h-full w-full place-items-center text-xl opacity-30">🧁</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {item.name}
          {item.isBestseller && <span className="ml-1.5 text-amber-500">★</span>}
        </p>
        <p className="text-sm text-[var(--muted)]">
          {item.priceText}
          {item.isEggless && " · Eggless"}
          {!item.isVeg && " · Non-veg"}
        </p>
      </div>

      <form action={toggleItemAvailable}>
        <input type="hidden" name="id" value={item.id} />
        <button
          type="submit"
          className={`btn ${
            item.isAvailable
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-red-200 bg-red-50 text-[var(--danger)]"
          }`}
          title="Click to flip"
        >
          {item.isAvailable ? "Available" : "Sold out"}
        </button>
      </form>

      <Link href={`/admin/items/${item.id}`} className="btn-ghost">Edit</Link>

      {confirming ? (
        <form action={deleteItem} className="flex items-center gap-1">
          <input type="hidden" name="id" value={item.id} />
          <button type="submit" className="btn-danger">Confirm</button>
          <button type="button" onClick={() => setConfirming(false)} className="btn-ghost">
            No
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="btn-danger">
          Delete
        </button>
      )}
    </div>
  );
}

function Move({
  id,
  direction,
  disabled,
}: {
  id: string;
  direction: "up" | "down";
  disabled: boolean;
}) {
  return (
    <form action={moveItem}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={`Move ${direction}`}
        className="px-1 text-xs text-[var(--muted)] disabled:opacity-25"
      >
        {direction === "up" ? "▲" : "▼"}
      </button>
    </form>
  );
}
