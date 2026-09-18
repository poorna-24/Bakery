// Shared file. An identical copy lives in bakery-admin/lib/hours.ts.
//
// Opening hours, and whether the shop is open right now.
//
// Everything is worked out in the shop's own timezone, never the phone's or
// the server's. A menu deployed to Vercel runs in UTC, and a customer could
// be on a phone still set to another country — neither should decide whether
// a bakery in Cherial is open.

export const SHOP_TIME_ZONE = "Asia/Kolkata";

export const HOURS_KEYS = {
  open: "hours.open",
  close: "hours.close",
  closedDays: "hours.closedDays",
} as const;

export type ShopHours = {
  /** "07:00" in 24-hour time. */
  open: string;
  /** "21:00". May be earlier than `open` for a shop that runs past midnight. */
  close: string;
  /** Weekday numbers the shop stays shut. 0 = Sunday. */
  closedDays: number[];
};

export const WEEKDAYS = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
] as const;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/** "07:30" -> 450 minutes past midnight. Null when it is not a valid time. */
export function toMinutes(time: string): number | null {
  const match = TIME_PATTERN.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** "07:30" -> "7:30 am", "21:00" -> "9:00 pm". */
export function formatTime(time: string): string {
  const minutes = toMinutes(time);
  if (minutes === null) return time;

  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour24 < 12 ? "am" : "pm";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/** Reads stored rows into hours, or null when the owner has not set any. */
export function toShopHours(rows: { key: string; value: string }[]): ShopHours | null {
  const map = new Map(rows.map((row) => [row.key, row.value]));

  const open = map.get(HOURS_KEYS.open) ?? "";
  const close = map.get(HOURS_KEYS.close) ?? "";
  if (!isValidTime(open) || !isValidTime(close)) return null;

  const closedDays = (map.get(HOURS_KEYS.closedDays) ?? "")
    .split(",")
    .map((part) => part.trim())
    // Number("") is 0, so an unset value would otherwise close the shop every
    // Sunday. Drop the empties before converting.
    .filter((part) => part.length > 0)
    .map(Number)
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);

  return { open, close, closedDays: [...new Set(closedDays)].sort() };
}

export type ShopNow = { minutes: number; weekday: number };

/** The current time and weekday in the shop's timezone. */
export function shopNow(at: Date = new Date(), timeZone = SHOP_TIME_ZONE): ShopNow {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(at);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

  // "24" shows up at midnight in some runtimes.
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  const shortNames = WEEKDAYS.map((day) => day.short);
  const weekday = shortNames.indexOf(get("weekday") as (typeof shortNames)[number]);

  return { minutes: hour * 60 + minute, weekday: weekday === -1 ? at.getDay() : weekday };
}

export type ShopStatus = {
  isOpen: boolean;
  /** "Open now" / "Closed" — the short badge text. */
  label: string;
  /** "7:00 am – 9:00 pm" or "Closed today", shown next to the badge. */
  detail: string;
};

/**
 * Whether the shop is open at `now`.
 *
 * Handles a closing time that falls after midnight: a shop open 18:00–02:00 is
 * open at 01:00, and that hour belongs to the previous day's shift, so the
 * weekly off is checked against the day the shift started.
 */
export function shopStatus(hours: ShopHours, now: ShopNow): ShopStatus {
  const open = toMinutes(hours.open);
  const close = toMinutes(hours.close);
  const range = `${formatTime(hours.open)} – ${formatTime(hours.close)}`;

  if (open === null || close === null) {
    return { isOpen: false, label: "Closed", detail: range };
  }

  // Same open and close means round the clock.
  if (open === close) {
    const closedToday = hours.closedDays.includes(now.weekday);
    return closedToday
      ? { isOpen: false, label: "Closed", detail: "Closed today" }
      : { isOpen: true, label: "Open now", detail: "Open 24 hours" };
  }

  const overnight = close < open;
  const yesterday = (now.weekday + 6) % 7;

  let withinHours: boolean;
  let shiftDay: number;

  if (overnight) {
    if (now.minutes >= open) {
      withinHours = true;
      shiftDay = now.weekday;
    } else if (now.minutes < close) {
      // Early hours — still yesterday's shift.
      withinHours = true;
      shiftDay = yesterday;
    } else {
      withinHours = false;
      shiftDay = now.weekday;
    }
  } else {
    withinHours = now.minutes >= open && now.minutes < close;
    shiftDay = now.weekday;
  }

  if (hours.closedDays.includes(shiftDay)) {
    const detail = shiftDay === now.weekday ? "Closed today" : range;
    return { isOpen: false, label: "Closed", detail };
  }

  if (withinHours) return { isOpen: true, label: "Open now", detail: range };

  // Shut, but say when it opens again if that is later today.
  const opensLaterToday = !overnight && now.minutes < open;
  return {
    isOpen: false,
    label: "Closed",
    detail: opensLaterToday ? `Opens ${formatTime(hours.open)}` : range,
  };
}
