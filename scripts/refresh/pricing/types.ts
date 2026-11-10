import type { ApartmentInfo, ManualPrices, UnitInfo } from "@/lib/schemas";
import type { RoomType } from "@/lib/types";
import type { Http } from "../../lib/http";

/** One room type as an adapter reads it; the refresh adds observedAt and source. */
export type UnitReading = Omit<UnitInfo, "observedAt" | "source">;

export interface PriceReading {
  /** Room types the source covers. Missing ones keep their previous values. */
  units: Partial<Record<RoomType, UnitReading>>;
  /** When the prices were checked, if not now (manual prices). */
  observedAt?: string;
}

export interface PricingContext {
  http: Http;
  manual: ManualPrices;
  /** Today, YYYY-MM-DD, for deciding whether a move-in date is in the future. */
  today: string;
}

export interface PricingAdapter {
  id: string;
  /** Recognizes the leasing platform in a page's HTML, so discovery can suggest this adapter. */
  detect?(html: string): boolean;
  read(listing: ApartmentInfo, context: PricingContext): Promise<PriceReading>;
}

/** Builds a room's reading from the open units' prices and move-in dates. */
export function fromOpenUnits(units: { price: number; availableOn: string | null }[], today: string): UnitReading {
  if (units.length === 0) return { status: "waitlist", minPrice: null, available: 0, availableFrom: null };
  const dates = units.map((u) => u.availableOn).filter((d): d is string => d !== null).sort();
  const soonest = dates[0] ?? null;
  return {
    status: "available",
    minPrice: Math.min(...units.map((u) => u.price)),
    available: units.length,
    // Only worth showing when nothing is open until later.
    availableFrom: soonest && soonest > today && units.every((u) => u.availableOn && u.availableOn > today) ? soonest : null,
  };
}

export function requireUrl(listing: ApartmentInfo): string {
  if (!listing.pricing.url) throw new Error(`${listing.id}: pricing.url is required for the "${listing.pricing.adapter}" adapter`);
  return listing.pricing.url;
}
