// Shared file. An identical copy lives in bakery-admin/lib/offer.ts.
//
// The announcement strip across the top of the menu — Diwali specials, a
// discount, "closed for Sankranti". The owner writes it, picks a colour, and
// can hide it without losing the text, because the same message usually comes
// back next festival.

export const OFFER_KEYS = {
  text: "offer.text",
  note: "offer.note",
  tone: "offer.tone",
  isVisible: "offer.isVisible",
} as const;

export type OfferTone = "festive" | "gold" | "fresh" | "berry";

export type OfferToneOption = {
  id: OfferTone;
  label: string;
  description: string;
  /** Class defined in both apps' globals.css. */
  className: string;
};

export const OFFER_TONES: OfferToneOption[] = [
  {
    id: "festive",
    label: "Festive red",
    description: "Loudest. For Diwali, Sankranti, anything you want noticed first.",
    className: "offer-festive",
  },
  {
    id: "gold",
    label: "Gold",
    description: "Warm and premium. Suits discounts and combo offers.",
    className: "offer-gold",
  },
  {
    id: "fresh",
    label: "Fresh green",
    description: "Calmer. Good for new arrivals or a daily special.",
    className: "offer-fresh",
  },
  {
    id: "berry",
    label: "Berry",
    description: "Distinct without shouting. Good for a standing notice.",
    className: "offer-berry",
  },
];

export const MAX_OFFER_TEXT = 90;
export const MAX_OFFER_NOTE = 120;

export type Offer = {
  text: string;
  /** Optional second line — terms, dates, "till stocks last". */
  note: string;
  tone: OfferTone;
  isVisible: boolean;
};

export function isOfferTone(value: string): value is OfferTone {
  return OFFER_TONES.some((tone) => tone.id === value);
}

export function offerToneClass(tone: OfferTone): string {
  return OFFER_TONES.find((option) => option.id === tone)?.className ?? "offer-festive";
}

/**
 * Reads stored rows into an offer.
 *
 * Null means show nothing: either the owner never wrote one, they hid it, or
 * the text is blank. The customer page should never render an empty strip.
 */
export function toOffer(rows: { key: string; value: string }[]): Offer | null {
  const map = new Map(rows.map((row) => [row.key, row.value]));

  const text = (map.get(OFFER_KEYS.text) ?? "").trim();
  if (!text) return null;

  // Anything other than an explicit "false" counts as visible, so an offer
  // saved before this flag existed still shows.
  const isVisible = map.get(OFFER_KEYS.isVisible) !== "false";
  if (!isVisible) return null;

  const storedTone = map.get(OFFER_KEYS.tone) ?? "";

  return {
    text,
    note: (map.get(OFFER_KEYS.note) ?? "").trim(),
    tone: isOfferTone(storedTone) ? storedTone : "festive",
    isVisible: true,
  };
}

/** What the admin form needs, including a hidden offer it can bring back. */
export function toOfferDraft(rows: { key: string; value: string }[]): Offer {
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const storedTone = map.get(OFFER_KEYS.tone) ?? "";

  return {
    text: (map.get(OFFER_KEYS.text) ?? "").trim(),
    note: (map.get(OFFER_KEYS.note) ?? "").trim(),
    tone: isOfferTone(storedTone) ? storedTone : "festive",
    isVisible: map.get(OFFER_KEYS.isVisible) !== "false",
  };
}
