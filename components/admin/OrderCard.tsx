import { setOrderPaid, setOrderStatus } from "@/app/admin/actions";
import { formatPrice } from "@/lib/types";
import { telHref, whatsappHref } from "@/lib/contact";
import { isPaymentMethod, paymentLabel, type OrderMode } from "@/lib/ordering";
import {
  STATUS_LABELS,
  isOpen,
  orderMapsLink,
  orderTime,
  whereLabel,
  type OrderStatus,
  type StoredOrder,
} from "@/lib/orders";

const STATUS_STYLES: Record<OrderStatus, string> = {
  new: "bg-blue-50 text-blue-800",
  preparing: "bg-amber-50 text-amber-800",
  ready: "bg-violet-50 text-violet-800",
  completed: "bg-emerald-50 text-emerald-800",
  cancelled: "bg-red-50 text-red-700",
};

/** The status buttons on an order still being dealt with; any can be pressed, in any order. */
const OPEN_ACTIONS: { status: OrderStatus; label: string }[] = [
  { status: "preparing", label: "Preparing" },
  { status: "ready", label: "Ready" },
  { status: "completed", label: "Completed" },
];

function StatusButton({ id, status, label, primary }: { id: string; status: OrderStatus; label: string; primary?: boolean }) {
  return (
    <form action={setOrderStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className={`${primary ? "btn-primary" : "btn-ghost"} w-full px-2 py-1.5 text-xs sm:w-auto sm:px-3 sm:text-sm`}>
        {label}
      </button>
    </form>
  );
}

/** One order on the dashboard: who and where, what, and the buttons to move it along. */
export default function OrderCard({
  order,
  status,
  todayStart,
}: {
  order: StoredOrder;
  /** The status to show — see effectiveStatus: yesterday's untouched orders count as completed. */
  status: OrderStatus;
  todayStart: Date;
}) {
  const autoCompleted = status === "completed" && order.status !== "completed";
  const maps = order.mode === "delivery" ? orderMapsLink(order) : null;
  const call = order.phone ? telHref(order.phone) : null;
  const chat = order.phone
    ? whatsappHref(order.phone, `Hi ${order.name}, about your order #${order.code} from us:`)
    : null;

  return (
    <article className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold">#{order.code}</span>
          <span className="font-semibold">{whereLabel(order)}</span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}>
            {STATUS_LABELS[status]}
            {autoCompleted ? " (auto)" : ""}
          </span>
        </div>
        <span className="text-xs text-[var(--muted)]">{orderTime(order.createdAt, todayStart)}</span>
      </div>

      {(call || order.whenText) && (
        <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-[var(--muted)]">
          {call && (
            <a href={call} className="underline">
              {order.phone}
            </a>
          )}
          {chat && (
            <a href={chat} target="_blank" rel="noopener noreferrer" className="underline">
              WhatsApp them
            </a>
          )}
          {order.whenText && <span>Wanted: {order.whenText}</span>}
        </p>
      )}

      <ul className="mt-3 space-y-0.5 text-sm">
        {order.lines.map((line, index) => (
          <li key={index} className="flex justify-between gap-3">
            <span>
              {line.qty} × {line.name}
              {line.size ? ` (${line.size})` : ""}
            </span>
            <span className="text-[var(--muted)]">{formatPrice(line.price * line.qty)}</span>
          </li>
        ))}
      </ul>

      {order.note && <p className="mt-2 rounded-lg bg-[var(--bg)] px-3 py-1.5 text-sm">Note: {order.note}</p>}

      {order.mode === "delivery" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span>{order.address}</span>
          {maps && (
            <a href={maps} target="_blank" rel="noopener noreferrer" className="btn-ghost px-3 py-1">
              Open in Maps
            </a>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-bold">Total {formatPrice(order.total)}</span>
          {isPaymentMethod(order.payment) && (
            <span className="text-[var(--muted)]">· {paymentLabel(order.payment, order.mode as OrderMode)}</span>
          )}
          <form action={setOrderPaid}>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="paid" value={order.paid ? "0" : "1"} />
            <button
              type="submit"
              title={order.paid ? "Mark as not paid" : "Mark as paid"}
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                order.paid ? "bg-emerald-50 text-emerald-800" : "bg-gray-100 text-gray-700"
              }`}
            >
              {order.paid ? "Paid ✓" : "Unpaid — mark paid"}
            </button>
          </form>
        </div>

        <div className={isOpen(status) ? "grid w-full grid-cols-4 gap-1.5 sm:flex sm:w-auto" : "flex gap-1.5"}>
          {isOpen(status) ? (
            <>
              {OPEN_ACTIONS.filter((action) => action.status !== status).map((action) => (
                <StatusButton
                  key={action.status}
                  id={order.id}
                  status={action.status}
                  label={action.label}
                  primary={action.status === "completed"}
                />
              ))}
              <StatusButton id={order.id} status="cancelled" label="Cancel" />
            </>
          ) : (
            <StatusButton id={order.id} status="new" label="Reopen" />
          )}
        </div>
      </div>
    </article>
  );
}
