/**
 * A strip across the top of every non-production site, so a test copy is
 * never mistaken for the live menu. Production sets no label and gets nothing.
 */
export default function EnvBanner({ label }: { label?: string }) {
  const text = label?.trim();
  if (!text) return null;

  return (
    <div className="bg-amber-400 px-3 py-1 text-center text-xs font-bold uppercase tracking-wider text-amber-950">
      {text} environment · not the live menu
    </div>
  );
}
