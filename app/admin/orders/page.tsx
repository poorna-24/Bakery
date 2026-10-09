import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  PERIODS,
  STATUS_LABELS,
  byHour,
  byMode,
  effectiveStatus,
  isOpen,
  isPeriod,
  periodStart,
  startOfShopDay,
  summarize,
  topItems,
  type OrderStatus,
} from "@/lib/orders";
import Shell from "@/components/admin/Shell";
import OrderCard from "@/components/admin/OrderCard";
import OrdersSummary from "@/components/admin/OrdersSummary";
import AutoRefresh from "@/components/admin/AutoRefresh";

export const dynamic = "force-dynamic";

const VIEWS = ["active", "new", "preparing", "ready", "completed", "cancelled", "all"] as const;
type View = (typeof VIEWS)[number];

const VIEW_LABELS: Record<View, string> = { active: "Active", ...STATUS_LABELS, all: "All" };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; period?: string }>;
}) {
  const params = await searchParams;
  const view: View = (VIEWS as readonly string[]).includes(params.view ?? "") ? (params.view as View) : "active";
  const period = params.period && isPeriod(params.period) ? params.period : "today";

  const now = new Date();
  const todayStart = startOfShopDay(now);
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: periodStart(period, now) } },
    include: { lines: true },
    orderBy: { createdAt: "desc" },
  });

  const rows = orders.map((order) => ({ order, status: effectiveStatus(order, todayStart) }));
  const matches = (status: OrderStatus, which: View) =>
    which === "all" || (which === "active" ? isOpen(status) : status === which);
  const shown = rows.filter((row) => matches(row.status, view));
  const newCount = rows.filter((row) => row.status === "new").length;

  const href = (next: { view?: View; period?: string }) =>
    `/admin/orders?view=${next.view ?? view}&period=${next.period ?? period}`;

  return (
    <Shell title="Orders">
      <AutoRefresh seconds={20} newCount={newCount} />

      <p className="max-w-2xl text-sm text-[var(--muted)]">
        Every order sent from the menu, kept for you here. Updating them is optional — anything you
        don&apos;t touch counts as completed at the end of the day. This page refreshes itself.
      </p>

      <nav className="mt-4 flex flex-wrap gap-1.5" aria-label="Period">
        {Object.entries(PERIODS).map(([key, label]) => (
          <Link
            key={key}
            href={href({ period: key })}
            aria-current={key === period ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              key === period ? "bg-[var(--text)] text-white" : "bg-white ring-1 ring-[var(--line)]"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-4">
        <OrdersSummary
          summary={summarize(orders, todayStart)}
          top={topItems(orders, todayStart)}
          modes={byMode(orders, todayStart)}
          hours={byHour(orders, todayStart)}
        />
      </div>

      <nav className="no-scrollbar -mx-4 mt-6 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0" aria-label="Order status">
        {VIEWS.map((key) => (
          <Link
            key={key}
            href={href({ view: key })}
            aria-current={key === view ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-sm ${
              key === view
                ? "bg-[var(--accent)] font-semibold text-white"
                : "bg-white text-[var(--muted)] ring-1 ring-[var(--line)]"
            }`}
          >
            {VIEW_LABELS[key]} · {rows.filter((row) => matches(row.status, key)).length}
          </Link>
        ))}
      </nav>

      <div className="mt-4 space-y-3">
        {shown.length === 0 ? (
          <p className="card px-4 py-10 text-center text-sm text-[var(--muted)]">
            No {view === "all" ? "" : `${VIEW_LABELS[view].toLowerCase()} `}orders{" "}
            {PERIODS[period].toLowerCase().replace("last", "in the last")}.
          </p>
        ) : (
          shown.map(({ order, status }) => (
            <OrderCard key={order.id} order={order} status={status} todayStart={todayStart} />
          ))
        )}
      </div>
    </Shell>
  );
}
