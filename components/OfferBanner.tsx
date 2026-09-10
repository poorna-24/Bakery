import type { Offer } from "@/lib/offer";
import { offerToneClass } from "@/lib/offer";

/**
 * The offer / festival strip, right at the top of the menu.
 *
 * Above the sticky header rather than inside it, so it is the first thing read
 * and then scrolls away — a permanent band would eat a fifth of a phone screen
 * for the rest of the visit.
 *
 * Rendered on the server from the owner's saved text. Nothing is clickable:
 * it is an announcement, and a customer tapping it expecting a page to open
 * would be a small disappointment every time.
 */
export default function OfferBanner({ offer }: { offer: Offer }) {
  return (
    <aside
      className={`px-4 py-3 text-center ${offerToneClass(offer.tone)}`}
      aria-label="Offer"
    >
      <p className="text-sm font-bold leading-snug tracking-tight">{offer.text}</p>
      {offer.note && <p className="mt-0.5 text-xs opacity-90">{offer.note}</p>}
    </aside>
  );
}
