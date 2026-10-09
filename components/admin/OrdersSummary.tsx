import { formatPrice } from "@/lib/types";
import { MODE_LABELS, type OrderMode } from "@/lib/ordering";
import type { OrderSummary } from "@/lib/orders";

const MODE_NAMES: Record<OrderMode, string> = {
  table: "At a table",
  counter: "At the counter",
  pickup: "Pickup",
  delivery: "Delivery",
};

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-[var(--line)]">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 text-xl font-bold">{value}</p>
    </div>
  );
}

function Bar({ share }: { share: number }) {
  return (
    <div className="mt-1 h-2 rounded-full bg-[var(--bg)]">
      <div className="h-2 rounded-full bg-[var(--accent)]" style={{ width: `${Math.round(share * 100)}%` }} />
    </div>
  );
}

/** The numbers at the top of the Orders page, for the chosen period. */
export default function OrdersSummary({
  summary,
  top,
  modes,
  hours,
}: {
  summary: OrderSummary;
  top: { name: string; qty: number }[];
  modes: { mode: OrderMode; count: number }[];
  /** Orders in each hour of the day, 0–23. */
  hours: number[];
}) {
  const topMax = top[0]?.qty ?? 1;
  const busiest = Math.max(...hours, 1);
  // Only the hours the shop actually sees orders in, so the chart is not mostly empty.
  const first = hours.findIndex((count) => count > 0);
  const last = 23 - [...hours].reverse().findIndex((count) => count > 0);

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Tile label="Orders" value={String(summary.orders)} />
        <Tile label="Sales" value={formatPrice(Math.round(summary.sales))} />
        <Tile label="Average order" value={formatPrice(Math.round(summary.average))} />
        <Tile label="Waiting now" value={String(summary.waiting)} />
        <Tile label="Still to collect" value={formatPrice(Math.round(summary.unpaid))} />
      </div>

      {summary.orders > 0 && (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="card p-4">
            <p className="mb-2 text-sm font-semibold">Top items</p>
            {top.map((item) => (
              <div key={item.name} className="mb-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="truncate">{item.name}</span>
                  <span className="text-[var(--muted)]">{item.qty}</span>
                </div>
                <Bar share={item.qty / topMax} />
              </div>
            ))}
          </div>

          <div className="card p-4">
            <p className="mb-2 text-sm font-semibold">How customers ordered</p>
            {modes.map((entry) => (
              <div key={entry.mode} className="mb-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span title={MODE_LABELS[entry.mode].title}>{MODE_NAMES[entry.mode]}</span>
                  <span className="text-[var(--muted)]">
                    {entry.count} · {Math.round((entry.count / summary.orders) * 100)}%
                  </span>
                </div>
                <Bar share={entry.count / summary.orders} />
              </div>
            ))}
          </div>

          <div className="card p-4">
            <p className="mb-2 text-sm font-semibold">Busy hours</p>
            <div className="flex h-24 items-end gap-1" role="img" aria-label="Orders by hour of the day">
              {hours.slice(first, last + 1).map((count, index) => (
                <div key={first + index} className="flex flex-1 flex-col items-center justify-end gap-1">
                  <div
                    className="w-full rounded-t bg-[var(--accent)]"
                    style={{ height: `${Math.max(4, Math.round((count / busiest) * 72))}px`, opacity: count ? 1 : 0.2 }}
                    title={`${count} order${count === 1 ? "" : "s"}`}
                  />
                  <span className="text-[10px] text-[var(--muted)]">{hourLabel(first + index)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** 0 -> "12a", 13 -> "1p". */
export function hourLabel(hour: number): string {
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}${hour < 12 ? "a" : "p"}`;
}
