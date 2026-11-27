"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteOldOrders } from "@/app/admin/actions";
import { CLEANUP_AGES, type CleanupAge } from "@/lib/orders";

const AGES = Object.keys(CLEANUP_AGES) as CleanupAge[];

function orders(count: number): string {
  return `${count} order${count === 1 ? "" : "s"}`;
}

/**
 * Bulk delete for old orders: pick an age, see how many orders it covers,
 * then confirm. Folded away at the foot of the Orders page because it is
 * rarely needed. Orders are tiny (about 1 KB each).
 */
export default function OrderCleanup({ counts }: { counts: Record<CleanupAge, number> }) {
  const [age, setAge] = useState<CleanupAge>("1y");
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState("");

  const count = counts[age];
  const label = CLEANUP_AGES[age];

  async function clear(formData: FormData) {
    const deleted = await deleteOldOrders(formData);
    setDone(`Deleted ${orders(deleted)} older than ${label}.`);
    setConfirming(false);
  }

  return (
    <details className="card mt-8 p-4">
      <summary className="cursor-pointer font-semibold">Clean up old orders</summary>
      <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
        Optional: orders take very little space. Deleting them also removes them from your
        history and totals, and can&apos;t be undone.
      </p>

      <form action={clear} className="mt-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="label" htmlFor="cleanup-age">
            Delete orders older than
          </label>
          <select
            id="cleanup-age"
            name="age"
            value={age}
            onChange={(event) => {
              setAge(event.target.value as CleanupAge);
              setConfirming(false);
              setDone("");
            }}
            className="field"
          >
            {AGES.map((key) => (
              <option key={key} value={key}>
                {CLEANUP_AGES[key]} ({orders(counts[key])})
              </option>
            ))}
          </select>
        </div>

        {count === 0 ? (
          <p className="pb-2 text-sm text-[var(--muted)]">Nothing older than {label}.</p>
        ) : confirming ? (
          <ConfirmButtons count={count} onCancel={() => setConfirming(false)} />
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="btn-danger">
            Delete {orders(count)}
          </button>
        )}
      </form>

      {done && (
        <p role="status" className="mt-3 text-sm font-semibold text-green-700">
          {done}
        </p>
      )}
    </details>
  );
}

/** Inside the form, so it can tell while the delete is still running. */
function ConfirmButtons({ count, onCancel }: { count: number; onCancel: () => void }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button type="submit" disabled={pending} className="btn-danger">
        {pending ? "Deleting…" : `Yes, delete ${orders(count)}`}
      </button>
      <button type="button" disabled={pending} onClick={onCancel} className="btn-ghost">
        No
      </button>
    </>
  );
}
