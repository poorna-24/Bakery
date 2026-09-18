"use client";

import { useEffect, useState } from "react";
import { shopNow, shopStatus, type ShopHours, type ShopStatus } from "@/lib/hours";

/**
 * The "Open now / Closed" pill under the shop name.
 *
 * The server works out the status so the first paint is already correct, and
 * that value seeds the client state — identical markup on both sides, so no
 * hydration mismatch. From then on it re-checks every minute, because a menu
 * left open on a table would otherwise still claim the shop is open long after
 * the shutters came down.
 */
export default function OpenStatus({
  hours,
  initial,
}: {
  hours: ShopHours;
  initial: ShopStatus;
}) {
  const [status, setStatus] = useState(initial);

  useEffect(() => {
    function refresh() {
      setStatus(shopStatus(hours, shopNow()));
    }

    refresh();
    const timer = setInterval(refresh, 60_000);

    // Coming back to a page left open for hours should not show stale hours.
    document.addEventListener("visibilitychange", refresh);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [hours]);

  return (
    <div
      className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5"
      // Announced once when it changes, not read out on every tick.
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${
          status.isOpen ? "bg-emerald-500" : "bg-red-500"
        }`}
      />
      <span
        className={`text-xs font-bold uppercase tracking-wide ${
          status.isOpen ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
        }`}
      >
        {status.label}
      </span>
      <span aria-hidden="true" className="text-[var(--line)]">
        |
      </span>
      <span className="text-xs text-[var(--muted)]">{status.detail}</span>
    </div>
  );
}
