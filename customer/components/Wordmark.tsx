/**
 * The shop name, set as a proper wordmark rather than a line of text.
 *
 * Two sizes: `hero` for the big centred one at the top of the page, `bar` for
 * the compact copy in the sticky header that fades in once the hero scrolls
 * away — so the name is always somewhere on screen, but never twice at once.
 */
export default function Wordmark({
  name,
  size,
}: {
  name: string;
  size: "hero" | "bar";
}) {
  if (size === "bar") {
    return (
      <span className="truncate text-[15px] font-extrabold uppercase tracking-[0.12em] text-[var(--accent)]">
        {name}
      </span>
    );
  }

  return (
    <h1 className="text-balance px-2 text-[clamp(1.9rem,9vw,2.75rem)] font-black uppercase leading-[1.05] tracking-[0.02em] text-[var(--text)]">
      {name}
    </h1>
  );
}

/** A small ornament: rule, diamond, rule. Sits under the hero name. */
export function Flourish() {
  return (
    <div aria-hidden="true" className="mt-4 flex items-center justify-center gap-3">
      <span className="h-px w-12 bg-gradient-to-r from-transparent to-[var(--accent)] opacity-60" />
      <span className="h-1.5 w-1.5 rotate-45 bg-[var(--accent)]" />
      <span className="h-px w-12 bg-gradient-to-l from-transparent to-[var(--accent)] opacity-60" />
    </div>
  );
}
