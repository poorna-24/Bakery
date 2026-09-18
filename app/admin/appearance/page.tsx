import { prisma } from "@/lib/db";
import { toAppearance } from "@/lib/backgrounds";
import Shell from "@/components/admin/Shell";
import BackgroundPicker from "@/components/admin/BackgroundPicker";

export const dynamic = "force-dynamic";

export default async function AppearancePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;

  const rows = await prisma.setting.findMany();
  const appearance = toAppearance(rows);

  // Read the raw value too: the owner may have a photo uploaded while showing
  // a different background, and the picker should still offer it back.
  const storedImageUrl =
    rows.find((row) => row.key === "background.imageUrl")?.value || null;

  return (
    <Shell title="Appearance" back={{ href: "/admin", label: "All categories" }}>
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">{error}</p>
      )}
      {saved && !error && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Saved. Reload the customer menu to see it.
        </p>
      )}

      <p className="max-w-2xl text-sm text-[var(--muted)]">
        Choose the background customers see behind the menu. Pick <strong>Plain</strong> to turn it
        off. The patterns are drawn by the page itself, so they cost nothing to load and stay sharp
        on every phone.
      </p>

      <BackgroundPicker selected={appearance.backgroundId} uploadedImageUrl={storedImageUrl} />
    </Shell>
  );
}
