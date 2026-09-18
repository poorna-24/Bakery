import { prisma } from "@/lib/db";
import { toOfferDraft } from "@/lib/offer";
import Shell from "@/components/admin/Shell";
import OfferForm from "@/components/admin/OfferForm";

export const dynamic = "force-dynamic";

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;

  const rows = await prisma.setting.findMany();
  const draft = toOfferDraft(rows);
  const exists = draft.text.length > 0;

  return (
    <Shell title="Offers & festivals" back={{ href: "/admin", label: "All categories" }}>
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">{error}</p>
      )}
      {saved && !error && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Saved. Reload the customer menu to see it.
        </p>
      )}

      <p className="max-w-2xl text-sm text-[var(--muted)]">
        A coloured strip across the very top of the menu — the first thing a customer reads after
        scanning. Use it for a festival, a discount, or a notice like “closed on Sunday”. Untick{" "}
        <strong>Show on the menu</strong> to hide it without losing the text, so the same message
        can come back next festival.
      </p>

      <OfferForm draft={draft} exists={exists} />
    </Shell>
  );
}
