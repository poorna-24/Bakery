/** − 2 + control for how many of something are in the order. */
export default function QtyStepper({
  qty,
  label,
  onChange,
}: {
  qty: number;
  /** What is being counted, for screen readers: "Black Forest Pastry". */
  label: string;
  onChange: (delta: number) => void;
}) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-xl bg-[var(--accent)] text-white">
      <button
        type="button"
        onClick={() => onChange(-1)}
        aria-label={`Remove one ${label}`}
        className="grid h-9 w-9 place-items-center text-lg font-bold"
      >
        −
      </button>
      <span aria-live="polite" className="min-w-5 text-center text-sm font-bold">
        {qty}
      </span>
      <button
        type="button"
        onClick={() => onChange(1)}
        aria-label={`Add one more ${label}`}
        className="grid h-9 w-9 place-items-center text-lg font-bold"
      >
        +
      </button>
    </span>
  );
}
