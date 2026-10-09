import { formatPrice } from "@/lib/types";

/**
 * The bar along the bottom once something is in the order: count, total, and
 * the way to review it.
 *
 * Strong on the ordering tab, where the customer is building the order. Quiet
 * on the browsing tab — a light pill rather than a faded bar, which would look
 * disabled — so it reminds without competing with the photos.
 */
export default function CartBar({
  count,
  total,
  onOpen,
  quiet = false,
}: {
  count: number;
  total: number;
  onOpen: () => void;
  quiet?: boolean;
}) {
  const items = `${count} item${count === 1 ? "" : "s"}`;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      {quiet ? (
        <button
          type="button"
          onClick={onOpen}
          className="mx-auto flex w-fit max-w-full animate-fadeIn items-center gap-3 rounded-full border border-[var(--accent)] bg-[var(--surface)] px-4 py-2 text-[var(--text)] shadow-md"
        >
          <span className="text-sm">
            <span aria-hidden="true">🛒 </span>
            <span className="font-semibold">{items}</span> · {formatPrice(total)}
          </span>
          <span className="text-sm font-bold text-[var(--accent)]">View order</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          className="mx-auto flex w-full max-w-[38rem] animate-fadeIn items-center justify-between rounded-2xl bg-[var(--text)] px-5 py-3.5 text-[var(--bg)] shadow-lg"
        >
          <span className="text-sm">
            <span className="font-semibold">{items}</span> · {formatPrice(total)}
          </span>
          <span className="text-sm font-bold">Review order →</span>
        </button>
      )}
    </div>
  );
}
