import { prisma } from "@/lib/db";
import { orderingConfig, toOrderingSettings } from "@/lib/ordering";
import Shell from "@/components/admin/Shell";
import OrderingForm from "@/components/admin/OrderingForm";

export const dynamic = "force-dynamic";

export default async function OrderingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;

  const settings = toOrderingSettings(await prisma.setting.findMany());
  const fallbackNumber = process.env.SHOP_WHATSAPP || process.env.SHOP_PHONE || "";
  const live = orderingConfig(settings, fallbackNumber);

  return (
    <Shell title="Ordering" back={{ href: "/admin", label: "All categories" }}>
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">{error}</p>
      )}
      {saved && !error && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Saved. Reload the customer menu to see it.
        </p>
      )}

      <p
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
          live ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-[var(--line)] bg-white"
        }`}
      >
        <span className={`h-2 w-2 rounded-full ${live ? "bg-emerald-500" : "bg-gray-400"}`} />
        {live ? (
          <>
            <strong>Ordering is on</strong> · orders go to {live.whatsapp}
          </>
        ) : (
          <>
            <strong>Ordering is off</strong> · customers see the menu only
          </>
        )}
      </p>

      <p className="mt-3 max-w-2xl text-sm text-[var(--muted)]">
        Customers add items on the menu and send the order to your WhatsApp as a ready-typed
        message, with their table number or name. Nothing is charged online — they pay at the
        counter as usual.
      </p>

      <OrderingForm settings={settings} fallbackNumber={fallbackNumber} />
    </Shell>
  );
}
