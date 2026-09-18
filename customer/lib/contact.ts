// How the shop is reached from the menu. Kept in one place because phone
// numbers are written a dozen ways ("+91 76660 93143", "076660-93143") and
// each destination wants a different shape:
//
//   tel:    likes the + and the country code, hates spaces
//   wa.me/  wants digits only, country code included, no + and no leading 0

/** Strips everything a human might type around the digits. Keeps a leading +. */
export function normalisePhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return "";

  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

/** `tel:` link, or null when no number is configured. */
export function telHref(raw: string): string | null {
  const number = normalisePhone(raw);
  return number ? `tel:${number}` : null;
}

/**
 * WhatsApp deep link. wa.me takes bare digits with the country code, so a
 * leading + is dropped and a local leading 0 is replaced by the country code.
 */
export function whatsappHref(raw: string, message?: string): string | null {
  let digits = normalisePhone(raw).replace(/^\+/, "");
  if (!digits) return null;

  // "076660 93143" is the local way of writing an Indian mobile.
  if (digits.startsWith("0")) digits = `91${digits.replace(/^0+/, "")}`;

  // A ten-digit number can only be missing its country code.
  if (digits.length === 10) digits = `91${digits}`;

  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** The message that opens in WhatsApp when someone asks about an item. */
export function itemEnquiry(shopName: string, itemName: string): string {
  return `Hi ${shopName}, I would like to know more about "${itemName}" from your menu.`;
}
