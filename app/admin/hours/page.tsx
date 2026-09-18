import { prisma } from "@/lib/db";
import { SHOP_TIME_ZONE, formatTime, shopNow, shopStatus, toShopHours } from "@/lib/hours";
import Shell from "@/components/admin/Shell";
import HoursForm from "@/components/admin/HoursForm";

export const dynamic = "force-dynamic";

export default async function HoursPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;

  const rows = await prisma.setting.findMany();
  const hours = toShopHours(rows);
  const status = hours ? shopStatus(hours, shopNow()) : null;

  return (
    <Shell title="Shop hours" back={{ href: "/admin", label: "All categories" }}>
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">{error}</p>
      )}
      {saved && !error && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Saved. Reload the customer menu to see it.
        </p>
      )}

      <p className="max-w-2xl text-sm text-[var(--muted)]">
        Customers see an <strong>Open now</strong> or <strong>Closed</strong> badge under the shop
        name, with the timings beside it. The badge updates itself on their phone as the day goes
        on — nobody has to flip a switch at closing time.
      </p>

      {status && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-sm">
          <span
            className={`h-2 w-2 rounded-full ${status.isOpen ? "bg-emerald-500" : "bg-red-500"}`}
          />
          <strong>{status.label}</strong>
          <span className="text-[var(--muted)]">{status.detail}</span>
          <span className="text-[var(--muted)]">· as customers see it right now</span>
        </p>
      )}

      <HoursForm
        open={hours?.open ?? "07:00"}
        close={hours?.close ?? "21:00"}
        closedDays={hours?.closedDays ?? []}
        isSet={Boolean(hours)}
      />

      <p className="mt-6 text-xs text-[var(--muted)]">
        Times are read in {SHOP_TIME_ZONE}, so the badge stays correct no matter where the customer&apos;s
        phone thinks it is. A closing time earlier than the opening time means the shop runs past
        midnight — {formatTime("18:00")} to {formatTime("02:00")}, for instance.
      </p>
    </Shell>
  );
}
