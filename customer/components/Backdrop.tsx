import type { Appearance } from "@/lib/backgrounds";
import { backgroundClass } from "@/lib/backgrounds";

/**
 * Paints whatever background the owner picked in the admin, behind everything.
 *
 * A fixed layer rather than `background-attachment: fixed`, which stutters or
 * silently breaks on iOS Safari — and a phone is the only place this is read.
 *
 * An uploaded photo gets a scrim over it. A menu has to stay readable above
 * all else, and dark text on somebody's kitchen photo does not.
 */
export default function Backdrop({ appearance }: { appearance: Appearance }) {
  const { backgroundId, backgroundImageUrl } = appearance;

  if (backgroundId === "custom" && backgroundImageUrl) {
    return (
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url("${backgroundImageUrl}")` }}
        />
        {/* Scrim: keeps prices legible whatever the photo looks like. */}
        <div className="absolute inset-0 scrim" />
      </div>
    );
  }

  const className = backgroundClass(backgroundId);
  if (!className) return null;

  return <div aria-hidden="true" className={`pointer-events-none fixed inset-0 -z-10 ${className}`} />;
}
