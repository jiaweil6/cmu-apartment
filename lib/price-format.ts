import { offeredPrice } from "./ranking";
import type { Apartment, RoomType } from "./types";

// Fixed locale and time zone so the server and browser render the same text.
const moveInFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** open: units to rent; waitlist: offered but full; muted: not offered or no data. */
export type PriceTone = "open" | "waitlist" | "muted";

export interface PriceParts {
  /** "$1,849", or null when there's no rent to show. */
  price: string | null;
  /** "6 open", "Available Dec 24", "Waitlist", "Not available", "Unknown", or null. */
  status: string | null;
  tone: PriceTone | null;
}

export function priceParts(apartment: Apartment, roomType: RoomType): PriceParts {
  const unit = apartment.units[roomType];
  if (unit.status === "not-offered") return { price: null, status: "Not available", tone: "muted" };
  const amount = offeredPrice(apartment, roomType);
  if (amount === null) {
    return unit.status === "waitlist"
      ? { price: null, status: "Waitlist", tone: "waitlist" }
      : { price: null, status: "Unknown", tone: "muted" };
  }
  const price = money.format(amount);
  if (unit.status === "waitlist") return { price, status: "Waitlist", tone: "waitlist" };
  if (unit.status === "available" && unit.availableFrom) {
    const from = moveInFormat.format(new Date(`${unit.availableFrom}T00:00:00Z`));
    return { price, status: `Available ${from}`, tone: "open" };
  }
  if (unit.status === "available" && unit.available) return { price, status: `${unit.available} open`, tone: "open" };
  return { price, status: null, tone: null };
}

/**
 * Why a room type shows no rent: the building has none ("not-offered"), has
 * them but none open and no rent posted ("waitlist"), or there's no data ("unknown").
 */
export function missingRent(apartment: Apartment, roomType: RoomType): "not-offered" | "waitlist" | "unknown" {
  const { status } = apartment.units[roomType];
  return status === "not-offered" || status === "waitlist" ? status : "unknown";
}

/** "$1,849 · 6 open", "$3,728 · Available Dec 24", "$5,200 · Waitlist", "Not available" or "Unknown". */
export function formatPrice(apartment: Apartment, roomType: RoomType): string {
  const { price, status } = priceParts(apartment, roomType);
  return [price, status].filter(Boolean).join(" · ");
}

const monthFormat = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/** "Feb 2024" when the prices are old enough to flag (see STALE_PRICE_DAYS), otherwise null. */
export function staleSince(apartment: Apartment): string | null {
  return apartment.pricesStale && apartment.pricesCheckedAt ? monthFormat.format(new Date(apartment.pricesCheckedAt)) : null;
}
