import { formatPrice } from "@/lib/types";

/** The bar along the bottom once something is in the order: count, total, and the way to review it. */
export default function CartBar({
  count,
  total,
  onOpen,
}: {
  count: number;
  total: number;
  onOpen: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <button
        type="button"
        onClick={onOpen}
        className="mx-auto flex w-full max-w-[38rem] animate-fadeIn items-center justify-between rounded-2xl bg-[var(--text)] px-5 py-3.5 text-[var(--bg)] shadow-lg"
      >
        <span className="text-sm">
          <span className="font-semibold">
            {count} item{count === 1 ? "" : "s"}
          </span>{" "}
          · {formatPrice(total)}
        </span>
        <span className="text-sm font-bold">Review order →</span>
      </button>
    </div>
  );
}
